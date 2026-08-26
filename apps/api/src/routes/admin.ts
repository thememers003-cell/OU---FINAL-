// ============================================================
// Admin — Dashboard and management endpoints
// ============================================================

import { Router, Request, Response } from 'express';

const router = Router();

// Dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalJobsToday,
      completedJobsToday,
      failedJobsToday,
      revenueToday,
      totalKiosks,
      onlineKiosks,
      totalPages,
    ] = await Promise.all([
      prisma.printJob.count({ where: { createdAt: { gte: today } } }),
      prisma.printJob.count({ where: { status: 'COMPLETED', createdAt: { gte: today } } }),
      prisma.printJob.count({ where: { status: 'FAILED', createdAt: { gte: today } } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: { gte: today } },
      }),
      prisma.kiosk.count(),
      prisma.kiosk.count({
        where: { lastHeartbeat: { gte: new Date(Date.now() - 60000) } },
      }),
      prisma.printJob.aggregate({
        _sum: { totalPages: true },
        where: { status: 'COMPLETED', createdAt: { gte: today } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        today: {
          revenue: revenueToday._sum.amount || 0,
          printJobs: totalJobsToday,
          pages: totalPages._sum.totalPages || 0,
          successful: completedJobsToday,
          failed: failedJobsToday,
        },
        kiosks: {
          total: totalKiosks,
          online: onlineKiosks,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get dashboard data' });
  }
});

// List all jobs with filters
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { status, printMethod, kioskId, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (printMethod) where.printMethod = printMethod;
    if (kioskId) where.kioskId = kioskId;

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
          fileName: j.file?.originalName,
          kioskName: j.kiosk?.displayId,
          kioskLocation: j.kiosk?.location,
          paymentStatus: j.payment?.status,
          paymentAmount: j.payment?.amount,
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
    res.status(500).json({ success: false, error: 'Failed to list jobs' });
  }
});

// Update pricing
router.put('/pricing', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { paperSize, colorMode, pricePerPage } = req.body;

    const rule = await prisma.pricingRule.upsert({
      where: { paperSize_colorMode: { paperSize, colorMode } },
      update: { pricePerPage },
      create: { paperSize, colorMode, pricePerPage, isActive: true },
    });

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update pricing' });
  }
});

// List kiosks for admin
router.get('/kiosks', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const kiosks = await prisma.kiosk.findMany({
      include: { printer: true },
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
        printerStatus: k.printer?.status || 'OFFLINE',
        printerName: k.printer?.name,
        lastHeartbeat: k.lastHeartbeat?.toISOString(),
        isOnline: k.lastHeartbeat
          ? Date.now() - new Date(k.lastHeartbeat).getTime() < 60000
          : false,
        cpu: k.cpu,
        ram: k.ram,
        disk: k.disk,
        appVersion: k.appVersion,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list kiosks' });
  }
});

export { router as adminRoutes };
