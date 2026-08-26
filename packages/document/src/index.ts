// ============================================================
// XPOS Document — PDF processing, DOCX conversion, and recognition
// ============================================================

import { PDFDocument } from 'pdf-lib';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType: string;
  extension: string;
}

export interface DocumentInfo {
  pageCount: number;
  mimeType: string;
  sizeBytes: number;
  convertedBuffer?: Buffer;
}

/**
 * Validate uploaded file type and size
 */
export function validateFile(
  originalName: string,
  mimeType: string,
  sizeBytes: number,
  maxSizeMB: number = 50
): FileValidationResult {
  const ext = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type ${ext} is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      mimeType,
      extension: ext,
    };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (sizeBytes > maxSizeBytes) {
    return {
      valid: false,
      error: `File size ${(sizeBytes / 1024 / 1024).toFixed(1)}MB exceeds maximum ${maxSizeMB}MB.`,
      mimeType,
      extension: ext,
    };
  }

  return { valid: true, mimeType, extension: ext };
}

/**
 * Get accurate page count from a PDF buffer
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  // Strategy 1: pdf-lib
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const count = pdfDoc.getPageCount();
    if (count > 0) return count;
  } catch (err) {
    console.warn('pdf-lib parser warning:', (err as Error).message);
  }

  // Strategy 2: Regex search for /Type /Page objects in raw PDF
  try {
    const text = buffer.toString('latin1');
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    if (matches && matches.length > 0) {
      return matches.length;
    }
  } catch {}

  // Strategy 3: Search for /Count in /Pages dictionary
  try {
    const text = buffer.toString('latin1');
    const countMatches = text.match(/\/Count\s+(\d+)/g);
    if (countMatches && countMatches.length > 0) {
      const counts = countMatches.map(m => parseInt(m.replace(/\/Count\s+/, ''))).filter(n => !isNaN(n));
      if (counts.length > 0) return Math.max(...counts);
    }
  } catch {}

  return 1;
}

export async function convertImageToPdf(imageBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const isPng = imageBuffer.length >= 4 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47;

  try {
    const pdfDoc = await PDFDocument.create();
    let image;
    if (isPng || mimeType.includes('png')) {
      try {
        image = await pdfDoc.embedPng(imageBuffer);
      } catch {
        image = await pdfDoc.embedJpg(imageBuffer);
      }
    } else {
      try {
        image = await pdfDoc.embedJpg(imageBuffer);
      } catch {
        image = await pdfDoc.embedPng(imageBuffer);
      }
    }

    const a4Width = 595.28;
    const a4Height = 841.89;
    const scale = Math.min(a4Width / image.width, a4Height / image.height, 1);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    const page = pdfDoc.addPage([a4Width, a4Height]);
    page.drawImage(image, {
      x: (a4Width - scaledWidth) / 2,
      y: (a4Height - scaledHeight) / 2,
      width: scaledWidth,
      height: scaledHeight,
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    console.warn('Image to PDF conversion fallback:', err);
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      page.drawText('Image Document', { x: 50, y: 750, size: 20 });
      return Buffer.from(await pdfDoc.save());
    } catch {
      return imageBuffer;
    }
  }
}

/**
 * Convert DOCX / DOC to PDF using Windows Word COM automation
 */
export async function convertDocxToPdf(docxBuffer: Buffer, originalName: string): Promise<Buffer | null> {
  const tempDir = path.join(os.tmpdir(), 'xpos-docx-convert');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const randomId = Math.random().toString(36).substring(2, 9);
  const tempDocxPath = path.join(tempDir, `${randomId}_${originalName}`);
  const tempPdfPath = path.join(tempDir, `${randomId}_converted.pdf`);

  try {
    await fs.promises.writeFile(tempDocxPath, docxBuffer);

    // Run PowerShell Word COM export
    const psScript = `
      $word = New-Object -ComObject Word.Application;
      $word.Visible = $false;
      $doc = $word.Documents.Open('${tempDocxPath.replace(/\\/g, '\\\\')}');
      $doc.SaveAs([ref]'${tempPdfPath.replace(/\\/g, '\\\\')}', [ref]17);
      $doc.Close();
      $word.Quit();
    `;

    await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);

    if (fs.existsSync(tempPdfPath)) {
      const pdfBuffer = await fs.promises.readFile(tempPdfPath);
      console.log(`✅ [DocumentConverter] Converted DOCX "${originalName}" to PDF (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    }
  } catch (err) {
    console.warn('DOCX to PDF Word COM conversion error:', err);
  } finally {
    try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch {}
    try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch {}
  }

  return null;
}

/**
 * Extract page count and convert document to printable PDF format
 */
export async function getDocumentInfo(
  buffer: Buffer,
  mimeType: string,
  fileName: string = ''
): Promise<DocumentInfo> {
  let pageCount = 1;
  let convertedBuffer: Buffer | undefined = undefined;

  const ext = path.extname(fileName).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    pageCount = Math.max(1, await getPdfPageCount(buffer));
  } else if (mimeType.startsWith('image/') || ext.match(/\.(jpg|jpeg|png)$/i)) {
    pageCount = 1;
    convertedBuffer = await convertImageToPdf(buffer, mimeType);
  } else if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx' || ext === '.doc'
  ) {
    // Convert DOCX to PDF for true rendering and physical printing
    const convertedPdf = await convertDocxToPdf(buffer, fileName || 'document.docx');
    if (convertedPdf) {
      convertedBuffer = convertedPdf;
      pageCount = Math.max(1, await getPdfPageCount(convertedPdf));
    } else {
      // Fallback: estimate page count from XML metadata
      try {
        const text = buffer.toString('utf-8');
        const pageMatch = text.match(/<Pages>(\d+)<\/Pages>/i);
        if (pageMatch) {
          pageCount = Math.max(1, parseInt(pageMatch[1]));
        } else {
          const wordsMatch = text.match(/<Words>(\d+)<\/Words>/i);
          pageCount = wordsMatch ? Math.max(1, Math.ceil(parseInt(wordsMatch[1]) / 300)) : 1;
        }
      } catch {
        pageCount = 1;
      }
    }
  }

  return {
    pageCount,
    mimeType: convertedBuffer ? 'application/pdf' : mimeType,
    sizeBytes: convertedBuffer ? convertedBuffer.length : buffer.length,
    convertedBuffer,
  };
}

/**
 * Parse page range string into page numbers
 */
export function parsePageRange(range: string, totalPages: number): number[] {
  const pages: Set<number> = new Set();
  const parts = range.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = Math.max(1, parseInt(startStr));
      const end = Math.min(totalPages, parseInt(endStr));
      for (let i = start; i <= end; i++) {
        pages.add(i);
      }
    } else {
      const page = parseInt(trimmed);
      if (page >= 1 && page <= totalPages) {
        pages.add(page);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Count pages from a range string
 */
export function countPagesInRange(range: string | null, totalPages: number): number {
  if (!range || !range.trim()) return totalPages;
  return parsePageRange(range, totalPages).length;
}

/**
 * Merge multiple uploaded files (PDFs, DOCX, images) into a single unified print document
 */
export async function mergeMultipleDocuments(
  files: Array<{ buffer: Buffer; mimeType: string; originalName: string }>
): Promise<{
  buffer: Buffer;
  pageCount: number;
  filesBreakdown: Array<{ name: string; pageCount: number; sizeBytes: number }>;
}> {
  if (files.length === 0) {
    throw new Error('No files provided to merge');
  }

  // Process all files in parallel for maximum speed
  const processedList = await Promise.all(
    files.map(async (f) => {
      try {
        const docInfo = await getDocumentInfo(f.buffer, f.mimeType, f.originalName);
        return {
          originalName: f.originalName,
          buffer: docInfo.convertedBuffer || f.buffer,
          pageCount: docInfo.pageCount,
          sizeBytes: f.buffer.length,
        };
      } catch (e) {
        console.warn(`Doc processing warning on ${f.originalName}:`, e);
        return {
          originalName: f.originalName,
          buffer: f.buffer,
          pageCount: 1,
          sizeBytes: f.buffer.length,
        };
      }
    })
  );

  if (processedList.length === 1) {
    return {
      buffer: processedList[0].buffer,
      pageCount: processedList[0].pageCount,
      filesBreakdown: [{
        name: processedList[0].originalName,
        pageCount: processedList[0].pageCount,
        sizeBytes: processedList[0].sizeBytes,
      }],
    };
  }

  const mergedPdf = await PDFDocument.create();

  for (const item of processedList) {
    try {
      const srcDoc = await PDFDocument.load(item.buffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((p) => mergedPdf.addPage(p));
    } catch (e) {
      console.warn(`Failed to copy pages for ${item.originalName}:`, e);
    }
  }

  const mergedBytes = await mergedPdf.save();
  return {
    buffer: Buffer.from(mergedBytes),
    pageCount: mergedPdf.getPageCount(),
    filesBreakdown: processedList.map(p => ({
      name: p.originalName,
      pageCount: p.pageCount,
      sizeBytes: p.sizeBytes,
    })),
  };
}

/**
 * Generate a storage key for uploaded files
 */
export function generateStorageKey(sessionId: string, fileName: string): string {
  const timestamp = Date.now();
  const ext = path.extname(fileName);
  const sanitized = path.basename(fileName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
  return `uploads/${sessionId}/${timestamp}_${sanitized}${ext}`;
}
