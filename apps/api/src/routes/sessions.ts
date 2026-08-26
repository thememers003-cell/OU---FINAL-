// ============================================================
// Sessions — Anonymous customer session management
// ============================================================

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create a new anonymous session
router.post('/', async (req: Request, res: Response) => {
  try {
    const { kioskId, printMethod } = req.body;
    const prisma = req.app.locals.prisma;

    // If kioskId provided (QR flow), verify kiosk exists and is active
    if (kioskId) {
      const kiosk = await prisma.kiosk.findFirst({
        where: { displayId: kioskId, status: 'ACTIVE' },
        include: { printer: true },
      });
      if (!kiosk) {
        return res.status(404).json({ success: false, error: 'Kiosk not found or unavailable' });
      }
    }

    const session = await prisma.session.create({
      data: {
        kioskId: kioskId ? (await prisma.kiosk.findUnique({ where: { displayId: kioskId } }))?.id : null,
        printMethod: printMethod || null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    res.json({
      success: true,
      data: {
        id: session.id,
        kioskId: kioskId || null,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

// Get session details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { kiosk: true },
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get session' });
  }
});

export { router as sessionRoutes };
