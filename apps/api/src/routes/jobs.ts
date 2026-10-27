// ============================================================
// Jobs — Print job creation and status
// ============================================================

import { Router, Request, Response } from 'express';

const router = Router();

// Create a print job
router.post('/', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const {
      sessionId,
      fileId,
      kioskId,
      printMethod,
      colorMode,
      paperSize,
      sides,
      copies,
      pageRange,
      totalPages,
      totalPrice,
    } = req.body;

    // Validate required fields
    if (!sessionId || !fileId) {
      return res.status(400).json({ success: false, error: 'sessionId and fileId are required' });
    }

    // Verify or auto-create session
    let session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      session = await prisma.session.create({
        data: {
          id: sessionId,
          printMethod: printMethod || 'CODE',
          status: 'ACTIVE',
        },
      });
    }

    // Verify file
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Get kiosk internal ID if display ID provided
    let kioskInternalId = null;
    if (kioskId) {
      const kiosk = await prisma.kiosk.findFirst({
        where: { OR: [{ id: kioskId }, { displayId: kioskId }] },
      });
      kioskInternalId = kiosk?.id || null;
    }

    // Get next job number for display ID
    const lastJob = await prisma.printJob.findFirst({
      orderBy: { jobNumber: 'desc' },
    });
    const nextNumber = (lastJob?.jobNumber || 0) + 1;
    const displayId = `XP-${String(nextNumber).padStart(6, '0')}`;

    const finalTotalPages = totalPages || file.pageCount || 1;
    const finalTotalPrice = totalPrice !== undefined ? totalPrice : 2;

    // Create job
    const job = await prisma.printJob.create({
      data: {
        displayId,
        sessionId,
        fileId,
        kioskId: kioskInternalId,
        printMethod: printMethod || 'CODE',
        status: 'CREATED',
        colorMode: colorMode || 'BW',
        paperSize: paperSize || 'A4',
        sides: sides || 'SINGLE',
        copies: copies || 1,
        pageRange: pageRange || null,
        totalPages: finalTotalPages,
        totalPrice: finalTotalPrice,
        jobNumber: nextNumber,
      },
      include: {
        file: true,
        kiosk: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'JOB_CREATED',
        entityType: 'PrintJob',
        entityId: job.id,
        kioskId: kioskInternalId,
        details: JSON.stringify({ printMethod, colorMode, copies, totalPrice }),
      },
    });

    // Notify real-time Admin Portal
    const io = req.app.locals.io;
    if (io) {
      io.to('admin').emit('job_updated', {
        id: job.id,
        displayId: job.displayId,
        status: job.status,
        totalPages: job.totalPages,
        totalPrice: job.totalPrice,
        colorMode: job.colorMode,
        fileName: job.file?.originalName,
        kioskName: job.kiosk?.displayId,
        createdAt: job.createdAt.toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        displayId: job.displayId,
        status: job.status,
        printMethod: job.printMethod,
        colorMode: job.colorMode,
        paperSize: job.paperSize,
        sides: job.sides,
        copies: job.copies,
        pageRange: job.pageRange,
        totalPages: job.totalPages,
        totalPrice: job.totalPrice,
        createdAt: job.createdAt.toISOString(),
        file: {
          id: job.file.id,
          originalName: job.file.originalName,
          pageCount: job.file.pageCount,
        },
        kiosk: job.kiosk ? {
          id: job.kiosk.id,
          displayId: job.kiosk.displayId,
          name: job.kiosk.name,
          location: job.kiosk.location,
        } : null,
      },
    });
  } catch (error) {
    console.error('Job creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create job' });
  }
});

// Get job status
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const job = await prisma.printJob.findFirst({
      where: {
        OR: [{ id: req.params.id }, { displayId: req.params.id }],
      },
      include: {
        file: true,
        kiosk: true,
        payment: true,
        printCode: true,
      },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        displayId: job.displayId,
        status: job.status,
        printMethod: job.printMethod,
        colorMode: job.colorMode,
        paperSize: job.paperSize,
        sides: job.sides,
        copies: job.copies,
        pageRange: job.pageRange,
        totalPages: job.totalPages,
        totalPrice: job.totalPrice,
        currentPage: job.currentPage,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() || null,
        file: {
          id: job.file.id,
          originalName: job.file.originalName,
          pageCount: job.file.pageCount,
        },
        kiosk: job.kiosk ? {
          displayId: job.kiosk.displayId,
          name: job.kiosk.name,
          location: job.kiosk.location,
        } : null,
        payment: job.payment ? {
          status: job.payment.status,
          amount: job.payment.amount,
          currency: job.payment.currency,
        } : null,
        printCode: job.printCode ? {
          status: job.printCode.status,
          expiresAt: job.printCode.expiresAt.toISOString(),
          usedAt: job.printCode.usedAt?.toISOString() || null,
          remainingSeconds: Math.max(0, Math.floor((job.printCode.expiresAt.getTime() - Date.now()) / 1000)),
        } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get job' });
  }
});

// Update job status (for kiosk use)
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const io = req.app.locals.io;
    const { status, currentPage, errorMessage } = req.body;

    const job = await prisma.printJob.findFirst({
      where: { OR: [{ id: req.params.id }, { displayId: req.params.id }] },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const updateData: any = { status };
    if (currentPage !== undefined) updateData.currentPage = currentPage;
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (status === 'COMPLETED') updateData.completedAt = new Date();

    const updated = await prisma.printJob.update({
      where: { id: job.id },
      data: updateData,
    });

    // Notify customer via WebSocket (both session room and broadcast)
    io.to(`session:${job.sessionId}`).emit('job_update', {
      type: 'JOB_UPDATE',
      jobId: job.id,
      displayId: job.displayId,
      status,
      currentPage,
      totalPages: job.totalPages,
    });
    io.emit('job_update', {
      type: 'JOB_UPDATE',
      jobId: job.id,
      displayId: job.displayId,
      status,
      currentPage,
      totalPages: job.totalPages,
    });

    // If completed, mark print code as used
    if (status === 'COMPLETED') {
      await prisma.printCode.updateMany({
        where: { jobId: job.id, status: 'ACTIVE' },
        data: { status: 'USED', usedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          action: 'JOB_COMPLETED',
          entityType: 'PrintJob',
          entityId: job.id,
          kioskId: job.kioskId,
        },
      });
    }

    res.json({ success: true, data: { status: updated.status } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update job status' });
  }
});

// ── Execute print — downloads file and sends to SavaPage / Kiosk Station ──
router.post('/:id/print', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const storage = req.app.locals.storage;
    const printer = req.app.locals.printer;
    const io = req.app.locals.io;

    const job = await prisma.printJob.findFirst({
      where: { OR: [{ id: req.params.id }, { displayId: req.params.id }] },
      include: { file: true, kiosk: true, payment: true },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Verify payment or status eligibility
    const hasPaidPayment = job.payment?.status === 'PAID' || await prisma.payment.findFirst({
      where: { jobId: job.id, status: 'PAID' },
    });

    if (!hasPaidPayment && job.status !== 'PAID' && job.status !== 'QUEUED' && job.status !== 'SENDING' && job.status !== 'PRINTING') {
      return res.status(400).json({ success: false, error: `Cannot print job in status: ${job.status}` });
    }

    // ⚡ Resolve target kiosk (by displayId, ID, or name)
    const targetStationInput = req.body.kioskId || job.kiosk?.displayId || job.kioskId;
    let targetKiosk: any = null;
    if (targetStationInput) {
      targetKiosk = await prisma.kiosk.findFirst({
        where: {
          OR: [
            { id: targetStationInput },
            { displayId: targetStationInput },
            { name: targetStationInput },
          ],
        },
      });
    }
    if (!targetKiosk && job.kiosk) {
      targetKiosk = job.kiosk;
    }

    const targetKioskId = targetKiosk?.displayId || targetStationInput || 'XPOS-001';
    const targetKioskUUID = targetKiosk?.id || job.kioskId;

    // Update status to PRINTING & associate target kiosk in DB
    await prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: 'PRINTING',
        ...(targetKioskUUID ? { kioskId: targetKioskUUID } : {}),
      },
    });

    // Generate fresh file download URL for kiosk
    let downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'https://xpos-printing-cloud.onrender.com'}/api/files/download/${job.file?.storageKey}`;
    try {
      if (storage?.getSignedUrl && job.file?.storageKey) {
        downloadUrl = await storage.getSignedUrl(job.file.storageKey, 3600);
      }
    } catch (e) {
      console.warn('Could not generate signed URL, using direct route:', e);
    }

    const kioskPayload = {
      type: 'NEW_JOB',
      jobId: job.id,
      displayId: job.displayId,
      totalPages: (job.totalPages || 1) * (job.copies || 1),
      fileName: job.file?.originalName || 'Document.pdf',
      colorMode: job.colorMode || 'BW',
      copies: job.copies || 1,
      sides: job.sides || 'SINGLE',
      paperSize: job.paperSize || 'A4',
      downloadUrl,
      targetKioskId,
      targetKioskUUID,
      kioskId: targetKioskUUID,
      job: {
        id: job.id,
        displayId: job.displayId,
        colorMode: job.colorMode,
        copies: job.copies || 1,
        sides: job.sides,
        totalPages: job.totalPages,
        kioskId: targetKioskUUID,
        kiosk: targetKiosk ? {
          id: targetKiosk.id,
          displayId: targetKiosk.displayId,
          name: targetKiosk.name,
        } : null,
        file: {
          originalName: job.file?.originalName || 'Document.pdf',
          storageKey: job.file?.storageKey,
        },
      },
    };

    // ⚡ REAL-TIME DISPATCH: Emit socket events to station, customer, and admin
    if (job.sessionId) {
      io.to(`session:${job.sessionId}`).emit('job_update', {
        type: 'JOB_UPDATE',
        jobId: job.id,
        displayId: job.displayId,
        status: 'PRINTING',
        currentPage: 1,
        totalPages: (job.totalPages || 1) * (job.copies || 1),
      });
    }

    io.emit('job_update', {
      type: 'JOB_UPDATE',
      jobId: job.id,
      displayId: job.displayId,
      status: 'PRINTING',
      currentPage: 1,
      totalPages: (job.totalPages || 1) * (job.copies || 1),
    });

    if (targetKioskUUID) {
      io.to(`kiosk:${targetKioskUUID}`).emit('new_job', kioskPayload);
    }
    if (targetKiosk?.displayId) {
      io.to(`kiosk:${targetKiosk.displayId}`).emit('new_job', kioskPayload);
    }
    if (targetStationInput && targetStationInput !== targetKiosk?.displayId && targetStationInput !== targetKioskUUID) {
      io.to(`kiosk:${targetStationInput}`).emit('new_job', kioskPayload);
    }

    // Direct paired print broadcast
    io.emit('kiosk_paired_print', kioskPayload);

    // Notify Admin Portal in Real Time
    io.to('admin').emit('job_updated', {
      id: job.id,
      displayId: job.displayId,
      status: 'PRINTING',
      targetKiosk: targetKioskId,
      kioskName: targetKioskId,
      updatedAt: new Date().toISOString(),
    });
    console.log(`⚡ Instant Print Event dispatched to Station ${targetKioskId} (UUID: ${targetKioskUUID})`);

    // Asynchronously trigger hardware printer driver if present locally on host
    (async () => {
      try {
        if (!printer || typeof printer.submitPrintJob !== 'function') return;
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        let tempFilePath = typeof storage?.getLocalFilePath === 'function' && job.file?.storageKey
          ? storage.getLocalFilePath(job.file.storageKey)
          : null;

        if ((!tempFilePath || !fs.existsSync(tempFilePath)) && job.file?.storageKey) {
          const tempDir = path.join(os.tmpdir(), 'xpos-print');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          const safeBaseName = path.basename(job.file.originalName, path.extname(job.file.originalName)).replace(/[^a-zA-Z0-9_-]/g, '_');
          tempFilePath = path.join(tempDir, `${job.id}_${safeBaseName}.pdf`);
          const fileBuffer = await storage.downloadFile(job.file.storageKey);
          fs.writeFileSync(tempFilePath, fileBuffer);
        }

        if (tempFilePath && fs.existsSync(tempFilePath)) {
          const printResult = await printer.submitPrintJob({
            filePath: tempFilePath,
            printerName: req.body.printerName || undefined,
            colorMode: job.colorMode,
            paperSize: job.paperSize,
            sides: job.sides,
            copies: job.copies || 1,
            pageRange: job.pageRange || undefined,
            totalPages: job.totalPages,
          });
          console.log(`🖨️ Local hardware printer submit: ${printResult?.jobId} (${printResult?.status})`);
        }
      } catch (err: any) {
        console.log(`ℹ️ [Hardware Printer] Cloud host bypassed local driver (${err?.message || err}). Kiosk station displays and outputs.`);
      }
    })();

    return res.json({
      success: true,
      message: 'Print job dispatched to station successfully',
      data: {
        jobId: job.id,
        displayId: job.displayId,
        status: 'PRINTING',
        targetKiosk: targetKioskId,
        totalPages: job.totalPages * (job.copies || 1),
      },
    });
  } catch (error: any) {
    console.error('Print execution error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to execute print job' });
  }
});

export { router as jobRoutes };
