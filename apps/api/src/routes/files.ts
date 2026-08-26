import { Router, Request, Response } from 'express';
import multer from 'multer';
import { validateFile, getDocumentInfo, mergeMultipleDocuments, generateStorageKey } from '@xpos/document';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024,
    files: 15,
  },
});

const router = Router();

// Upload single or multiple documents / photos (up to 15 files)
router.post('/upload', upload.any(), async (req: Request, res: Response) => {
  try {
    const rawFiles = (req.files as Express.Multer.File[]) || [];
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID required' });
    }

    const prisma = req.app.locals.prisma;
    const storage = req.app.locals.storage;

    // Verify or auto-create session
    let session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      session = await prisma.session.create({
        data: {
          id: sessionId,
          printMethod: 'CODE',
          status: 'ACTIVE',
        },
      });
    }

    // Validate all files
    const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || '50');
    for (const f of rawFiles) {
      const validation = validateFile(f.originalname, f.mimetype, f.size, maxSize);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }
    }

    let finalBuffer: Buffer;
    let finalPageCount: number;
    let finalOriginalName: string;
    const finalMime = 'application/pdf';

    let filesBreakdown: Array<{ name: string; pageCount: number; sizeBytes: number }> = [];

    if (rawFiles.length === 1) {
      const single = rawFiles[0];
      const docInfo = await getDocumentInfo(single.buffer, single.mimetype, single.originalname);
      finalBuffer = docInfo.convertedBuffer || single.buffer;
      finalPageCount = docInfo.pageCount;
      finalOriginalName = single.originalname;
      filesBreakdown = [{
        name: single.originalname,
        pageCount: docInfo.pageCount,
        sizeBytes: single.size,
      }];
    } else {
      // Merge all files/photos into a single unified print document in parallel
      const merged = await mergeMultipleDocuments(
        rawFiles.map(f => ({ buffer: f.buffer, mimeType: f.mimetype, originalName: f.originalname }))
      );
      finalBuffer = merged.buffer;
      finalPageCount = merged.pageCount;
      finalOriginalName = `${rawFiles.length}_Files_Combined.pdf`;
      filesBreakdown = merged.filesBreakdown;
    }

    // Generate storage key and upload
    const storageKey = generateStorageKey(sessionId, finalOriginalName);
    await storage.uploadFile(storageKey, finalBuffer, finalMime);

    // Create file record in database
    const file = await prisma.file.create({
      data: {
        originalName: finalOriginalName,
        mimeType: finalMime,
        sizeBytes: finalBuffer.length,
        pageCount: finalPageCount,
        storageKey,
        sessionId,
      },
    });

    const downloadUrl = `/api/files/download/${encodeURIComponent(storageKey)}`;

    res.json({
      success: true,
      data: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        pageCount: file.pageCount,
        filesCount: rawFiles.length,
        filesBreakdown,
        downloadUrl,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// Get file info
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const file = await prisma.file.findUnique({ where: { id: req.params.id } });

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.json({
      success: true,
      data: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        pageCount: file.pageCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get file info' });
  }
});

// Get file preview URL (signed, temporary)
router.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const storage = req.app.locals.storage;

    const file = await prisma.file.findUnique({ where: { id: req.params.id } });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const signedUrl = await storage.getSignedUrl(file.storageKey, 300);

    res.json({
      success: true,
      data: {
        previewUrl: signedUrl,
        expiresIn: 300,
        pageCount: file.pageCount,
        mimeType: file.mimeType,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate preview' });
  }
});

// Download/stream file content (inline for browser preview)
router.get('/download/:key(*)', async (req: Request, res: Response) => {
  try {
    const storage = req.app.locals.storage;
    const key = req.params.key;
    const buffer = await storage.downloadFile(key);
    
    const ext = require('path').extname(key).toLowerCase();
    let mime = 'application/octet-stream';
    if (ext === '.pdf') mime = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.png') mime = 'image/png';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(require('path').basename(key))}"`);
    res.send(buffer);
  } catch (error) {
    res.status(404).json({ success: false, error: 'File not found' });
  }
});

// Delete a file
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const storage = req.app.locals.storage;

    const file = await prisma.file.findUnique({ where: { id: req.params.id } });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Delete from storage
    await storage.deleteFile(file.storageKey);

    // Mark as deleted
    await prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

export { router as fileRoutes };
