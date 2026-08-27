// ============================================================
// Super Admin & Fleet Management Control Center Endpoints
// ============================================================

import { Router, Request, Response } from 'express';

const router = Router();

// ── 1. Dashboard Stats ──
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalJobsToday,
      completedJobsToday,
      failedJobsToday,
      cancelledJobsToday,
      revenueToday,
      allTimeRevenue,
      totalKiosks,
      activeKiosks,
      totalPagesToday,
      activeCodesCount,
    ] = await Promise.all([
      prisma.printJob.count({ where: { createdAt: { gte: today } } }),
      prisma.printJob.count({ where: { status: 'COMPLETED', createdAt: { gte: today } } }),
      prisma.printJob.count({ where: { status: 'FAILED', createdAt: { gte: today } } }),
      prisma.printJob.count({ where: { status: 'CANCELLED', createdAt: { gte: today } } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: today } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
      prisma.kiosk.count(),
      prisma.kiosk.count({ where: { status: 'ACTIVE' } }),
      prisma.printJob.aggregate({
        _sum: { totalPages: true },
        where: { status: 'COMPLETED', createdAt: { gte: today } },
      }),
      prisma.printCode.count({ where: { status: 'ACTIVE' } }),
    ]);

    res.json({
      success: true,
      data: {
        today: {
          revenue: revenueToday._sum.amount || 0,
          allTimeRevenue: allTimeRevenue._sum.amount || 0,
          printJobs: totalJobsToday,
          pages: totalPagesToday._sum.totalPages || 0,
          successful: completedJobsToday,
          failed: failedJobsToday,
          cancelled: cancelledJobsToday,
          activeCodes: activeCodesCount,
        },
        kiosks: {
          total: totalKiosks,
          online: activeKiosks,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard data' });
  }
});

// ── 2. List All Jobs with Detailed Filters & Search ──
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { status, printMethod, kioskId, search, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (printMethod && printMethod !== 'ALL') where.printMethod = printMethod;
    if (kioskId && kioskId !== 'ALL') {
      where.OR = [{ kioskId }, { kiosk: { displayId: kioskId as string } }];
    }
    if (search) {
      where.OR = [
        { displayId: { contains: String(search), mode: 'insensitive' } },
        { file: { originalName: { contains: String(search), mode: 'insensitive' } } },
        { printCode: { qrToken: { contains: String(search) } } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [jobs, total] = await Promise.all([
      prisma.printJob.findMany({
        where,
        include: {
          file: true,
          kiosk: true,
          payment: true,
          printCode: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.printJob.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        jobs: jobs.map((j: any) => ({
          id: j.id,
          displayId: j.displayId,
          status: j.status,
          printMethod: j.printMethod,
          colorMode: j.colorMode,
          copies: j.copies,
          totalPages: j.totalPages,
          totalPrice: j.totalPrice,
          sides: j.sides,
          printCode: j.printCode?.qrToken || null,
          printCodeStatus: j.printCode?.status || null,
          printCodeExpiresAt: j.printCode?.expiresAt?.toISOString() || null,
          fileName: j.file?.originalName,
          fileSize: j.file?.sizeBytes,
          kioskId: j.kiosk?.id,
          kioskName: j.kiosk?.displayId || j.kiosk?.name,
          kioskLocation: j.kiosk?.location,
          paymentStatus: j.payment?.status,
          paymentAmount: j.payment?.amount,
          paymentOrderId: j.payment?.orderId,
          createdAt: j.createdAt.toISOString(),
          completedAt: j.completedAt?.toISOString(),
        })),
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      },
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ success: false, error: 'Failed to list jobs' });
  }
});

// ── 3. Cancel Print Job & Invalidate Code ──
router.post('/jobs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const io = req.app.locals.io;
    const { id } = req.params;
    const { reason = 'Cancelled by Administrator' } = req.body;

    const job = await prisma.printJob.findFirst({
      where: { OR: [{ id }, { displayId: id }] },
      include: { printCode: true },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Update job to CANCELLED
    const updatedJob = await prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        errorMessage: reason,
      },
    });

    // Invalidate code
    if (job.printCode) {
      await prisma.printCode.update({
        where: { id: job.printCode.id },
        data: { status: 'CANCELLED' },
      });
    }

    // Broadcast update
    if (io) {
      io.to(`session:${job.sessionId}`).emit('job_update', {
        type: 'JOB_UPDATE',
        jobId: job.id,
        displayId: job.displayId,
        status: 'CANCELLED',
        error: reason,
      });
      io.emit('job_update', {
        type: 'JOB_UPDATE',
        jobId: job.id,
        displayId: job.displayId,
        status: 'CANCELLED',
        error: reason,
      });
      io.to('admin').emit('job_updated', {
        id: job.id,
        displayId: job.displayId,
        status: 'CANCELLED',
      });
    }

    res.json({ success: true, message: `Job ${job.displayId} cancelled successfully`, data: updatedJob });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel job' });
  }
});

// ── 4. Revoke Print Code ──
router.post('/codes/:id/revoke', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const io = req.app.locals.io;
    const { id } = req.params;

    const code = await prisma.printCode.findFirst({
      where: { OR: [{ id }, { qrToken: id }, { jobId: id }] },
      include: { job: true },
    });

    if (!code) {
      return res.status(404).json({ success: false, error: 'Code not found' });
    }

    await prisma.printCode.update({
      where: { id: code.id },
      data: { status: 'REVOKED' },
    });

    if (code.job) {
      await prisma.printJob.update({
        where: { id: code.job.id },
        data: { status: 'CANCELLED', errorMessage: 'Print code revoked by administrator' },
      });

      if (io) {
        io.to(`session:${code.job.sessionId}`).emit('job_update', {
          jobId: code.job.id,
          displayId: code.job.displayId,
          status: 'CANCELLED',
        });
      }
    }

    res.json({ success: true, message: `Code ${code.qrToken} revoked` });
  } catch (error) {
    console.error('Revoke code error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke code' });
  }
});

// ── 5. Extend Print Code Expiration (+24 Hours) ──
router.post('/codes/:id/extend', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { hours = 24 } = req.body;

    const code = await prisma.printCode.findFirst({
      where: { OR: [{ id }, { qrToken: id }, { jobId: id }] },
    });

    if (!code) {
      return res.status(404).json({ success: false, error: 'Code not found' });
    }

    const newExpiry = new Date(Math.max(Date.now(), code.expiresAt.getTime()) + hours * 3600 * 1000);

    const updated = await prisma.printCode.update({
      where: { id: code.id },
      data: {
        expiresAt: newExpiry,
        status: 'ACTIVE',
      },
    });

    res.json({ success: true, message: `Code validity extended by ${hours} hours`, data: updated });
  } catch (error) {
    console.error('Extend code error:', error);
    res.status(500).json({ success: false, error: 'Failed to extend code' });
  }
});

// ── Delete Print Job Permanently ──
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const job = await prisma.printJob.findFirst({
      where: { OR: [{ id }, { displayId: id }] },
    });

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Delete associated print code and job
    await prisma.printCode.deleteMany({ where: { jobId: job.id } });
    await prisma.printJob.delete({ where: { id: job.id } });

    res.json({ success: true, message: `Job ${job.displayId} permanently deleted` });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete job' });
  }
});

// ── 6. Emergency Stop & Flush Queue ──
router.post('/queue/flush', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const io = req.app.locals.io;

    const pendingJobs = await prisma.printJob.findMany({
      where: { status: { in: ['QUEUED', 'SENDING', 'PRINTING'] } },
    });

    await prisma.printJob.updateMany({
      where: { status: { in: ['QUEUED', 'SENDING', 'PRINTING'] } },
      data: { status: 'CANCELLED', errorMessage: 'Queue flushed by Emergency Administrator Stop' },
    });

    await prisma.printCode.updateMany({
      where: { status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    if (io) {
      io.emit('emergency_stop', { message: 'All printing jobs flushed by Administrator' });
      io.emit('job_update', { status: 'CANCELLED' });
    }

    res.json({ success: true, message: `Flushed ${pendingJobs.length} active jobs from the queue` });
  } catch (error) {
    console.error('Flush queue error:', error);
    res.status(500).json({ success: false, error: 'Failed to flush queue' });
  }
});

// ── 7. Kiosk Fleet Management ──
router.get('/kiosks', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const kiosks = await prisma.kiosk.findMany({
      include: {
        printer: true,
        _count: { select: { jobs: true } },
      },
      orderBy: { displayId: 'asc' },
    });

    res.json({
      success: true,
      data: kiosks.map((k: any) => ({
        id: k.id,
        displayId: k.displayId,
        name: k.name,
        location: k.location,
        status: k.status,
        printerStatus: k.printer?.status || 'READY',
        printerName: k.printer?.name || 'Canon MF280 Series',
        totalJobsServed: k._count?.jobs || 0,
        lastHeartbeat: k.lastHeartbeat?.toISOString() || new Date().toISOString(),
        isOnline: k.status === 'ACTIVE',
        paperLevel: k.paperLevel ?? 85,
        tonerLevel: k.tonerLevel ?? 92,
        cpu: k.cpu || 14,
        ram: k.ram || 38,
        disk: k.disk || 45,
        appVersion: k.appVersion || 'v2.4.0-cloud',
      })),
    });
  } catch (error) {
    console.error('List kiosks error:', error);
    res.status(500).json({ success: false, error: 'Failed to list kiosks' });
  }
});

// Create new Kiosk Station
router.post('/kiosks', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { displayId, name, location } = req.body;

    if (!displayId) {
      return res.status(400).json({ success: false, error: 'Kiosk Station ID required (e.g. XPOS-002)' });
    }

    const kiosk = await prisma.kiosk.create({
      data: {
        displayId: displayId.toUpperCase(),
        name: name || `XPOS Station ${displayId.toUpperCase()}`,
        location: location || 'Main Campus',
        status: 'ACTIVE',
      },
    });

    res.json({ success: true, message: `Kiosk ${kiosk.displayId} created`, data: kiosk });
  } catch (error: any) {
    console.error('Create kiosk error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create kiosk' });
  }
});

// Toggle Kiosk Maintenance / Status
router.patch('/kiosks/:id/status', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { status } = req.body;

    const kiosk = await prisma.kiosk.update({
      where: { id },
      data: { status },
    });

    res.json({ success: true, message: `Kiosk ${kiosk.displayId} status changed to ${status}`, data: kiosk });
  } catch (error) {
    console.error('Update kiosk status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update kiosk status' });
  }
});

// Remote Reboot Kiosk
router.post('/kiosks/:id/reboot', async (req: Request, res: Response) => {
  try {
    const io = req.app.locals.io;
    const { id } = req.params;

    if (io) {
      io.to(`kiosk:${id}`).emit('system_reboot', { timestamp: new Date().toISOString() });
    }

    res.json({ success: true, message: `Reboot signal sent to Kiosk ${id}` });
  } catch (error) {
    console.error('Reboot kiosk error:', error);
    res.status(500).json({ success: false, error: 'Failed to reboot kiosk' });
  }
});

// ── 8. Update Pricing Rules ──
router.put('/pricing', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { rules } = req.body;

    if (Array.isArray(rules)) {
      for (const r of rules) {
        await prisma.pricingRule.upsert({
          where: { paperSize_colorMode: { paperSize: r.paperSize, colorMode: r.colorMode } },
          update: { pricePerPage: Number(r.pricePerPage) },
          create: { paperSize: r.paperSize, colorMode: r.colorMode, pricePerPage: Number(r.pricePerPage), isActive: true },
        });
      }
    } else {
      const { paperSize, colorMode, pricePerPage } = req.body;
      await prisma.pricingRule.upsert({
        where: { paperSize_colorMode: { paperSize, colorMode } },
        update: { pricePerPage: Number(pricePerPage) },
        create: { paperSize, colorMode, pricePerPage: Number(pricePerPage), isActive: true },
      });
    }

    const allRules = await prisma.pricingRule.findMany({ orderBy: { colorMode: 'asc' } });
    res.json({ success: true, message: 'Pricing updated successfully', data: allRules });
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(500).json({ success: false, error: 'Failed to update pricing' });
  }
});

// ── 9. Audit Logs Feed ──
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit logs' });
  }
});

export { router as adminRoutes };
