// ============================================================
// Kiosks — Kiosk listing and status endpoints
// ============================================================

import { Router, Request, Response } from 'express';
import * as QRCode from 'qrcode';

const router = Router();

// List all available kiosks
router.get('/', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const showAll = req.query.showAll === 'true';

    const kiosks = await prisma.kiosk.findMany({
      where: showAll ? {} : { status: 'ACTIVE' },
      include: { printer: true },
      orderBy: { displayId: 'asc' },
    });

    const formatted = kiosks.map((k: any) => ({
      id: k.id,
      displayId: k.displayId,
      name: k.name,
      location: k.location,
      status: k.status,
      printerStatus: k.printer?.status || 'OFFLINE',
      qrUrl: k.qrUrl,
      lastHeartbeat: k.lastHeartbeat?.toISOString() || null,
      isOnline: k.lastHeartbeat
        ? Date.now() - new Date(k.lastHeartbeat).getTime() < 60000
        : false,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Kiosk listing error:', error);
    res.status(500).json({ success: false, error: 'Failed to list kiosks' });
  }
});

// Create a new kiosk dynamically
router.post('/', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { displayId, name, location, printerName = 'MF280 Series', colorCapabilities = ['BW', 'COLOR'] } = req.body;

    if (!displayId || !name || !location) {
      return res.status(400).json({ success: false, error: 'Kiosk ID, Name, and Location are required' });
    }

    const existing = await prisma.kiosk.findUnique({ where: { displayId } });
    if (existing) {
      return res.status(400).json({ success: false, error: `Kiosk with ID "${displayId}" already exists` });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrUrl = `${appUrl}/remote?kiosk=${displayId}`;

    const kiosk = await prisma.kiosk.create({
      data: {
        displayId,
        name,
        location,
        status: 'ACTIVE',
        qrUrl,
        printer: {
          create: {
            name: printerName || 'MF280 Series',
            model: 'Canon Laser Multifunction',
            status: 'READY',
          },
        },
      },
      include: { printer: true },
    });

    const io = req.app.locals.io;
    if (io) {
      io.emit('kiosks_updated', { type: 'KIOSK_ADDED', kiosk });
      io.to('admin').emit('kiosk_added', kiosk);
    }

    res.json({
      success: true,
      data: {
        id: kiosk.id,
        displayId: kiosk.displayId,
        name: kiosk.name,
        location: kiosk.location,
        status: kiosk.status,
        printerStatus: kiosk.printer?.status || 'READY',
        qrUrl: kiosk.qrUrl,
        lastHeartbeat: null,
        isOnline: false,
      },
    });
  } catch (error) {
    console.error('Kiosk creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create kiosk' });
  }
});

// Get single kiosk details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const kiosk = await prisma.kiosk.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { displayId: req.params.id },
        ],
      },
      include: { printer: true },
    });

    if (!kiosk) {
      return res.status(404).json({ success: false, error: 'Kiosk not found' });
    }

    res.json({
      success: true,
      data: {
        id: kiosk.id,
        displayId: kiosk.displayId,
        name: kiosk.name,
        location: kiosk.location,
        status: kiosk.status,
        printerStatus: kiosk.printer?.status || 'OFFLINE',
        printerName: kiosk.printer?.name || null,
        qrUrl: kiosk.qrUrl,
        lastHeartbeat: kiosk.lastHeartbeat?.toISOString() || null,
        isOnline: kiosk.lastHeartbeat
          ? Date.now() - new Date(kiosk.lastHeartbeat).getTime() < 60000
          : false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get kiosk details' });
  }
});

// Get QR code image for a kiosk
router.get('/:id/qr', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const kiosk = await prisma.kiosk.findFirst({
      where: {
        OR: [{ id: req.params.id }, { displayId: req.params.id }],
      },
    });

    if (!kiosk) {
      return res.status(404).json({ success: false, error: 'Kiosk not found' });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrUrl = `${appUrl}/print?kiosk=${kiosk.displayId}`;

    const qrImage = await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.json({ success: true, data: { qrImage, qrUrl, kioskId: kiosk.displayId } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// Kiosk heartbeat
router.post('/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const { cpu, ram, disk, internet, appVersion, printerStatus, currentJobId } = req.body;

    const kiosk = await prisma.kiosk.findFirst({
      where: {
        OR: [{ id: req.params.id }, { displayId: req.params.id }],
      },
    });

    if (!kiosk) {
      return res.status(404).json({ success: false, error: 'Kiosk not found' });
    }

    await prisma.kiosk.update({
      where: { id: kiosk.id },
      data: {
        lastHeartbeat: new Date(),
        cpu,
        ram,
        disk,
        appVersion,
      },
    });

    // Update printer status
    if (printerStatus) {
      await prisma.printer.updateMany({
        where: { kioskId: kiosk.id },
        data: {
          status: printerStatus,
          currentJobId: currentJobId || null,
        },
      });
    }

    res.json({ success: true, data: { acknowledged: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Heartbeat failed' });
  }
});

export { router as kioskRoutes };
