// ============================================================
// Payments — Payment creation and verification
// ============================================================

import { Router, Request, Response } from 'express';

const router = Router();

// Create a payment order
router.post('/create', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const payment = req.app.locals.payment;
    const { jobId, returnUrl } = req.body;

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'Job ID required' });
    }

    // Get job
    const job = await prisma.printJob.findFirst({
      where: { OR: [{ id: jobId }, { displayId: jobId }] },
    });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment.findUnique({ where: { jobId: job.id } });
    if (existingPayment && existingPayment.status === 'PAID') {
      return res.json({
        success: true,
        data: {
          paymentId: existingPayment.id,
          status: 'PAID',
          message: 'Payment already completed',
        },
      });
    }

    // Create payment order via provider
    const order = await payment.createOrder(job.totalPrice, 'INR', {
      jobId: job.id,
      displayId: job.displayId,
      returnUrl: returnUrl || '',
    });

    // Store or update payment record idempotently
    const paymentRecord = await prisma.payment.upsert({
      where: { jobId: job.id },
      update: {
        amount: job.totalPrice,
        providerOrderId: order.orderId,
        qrData: order.qrData,
        status: 'PAYMENT_PENDING',
      },
      create: {
        jobId: job.id,
        amount: job.totalPrice,
        currency: 'INR',
        provider: payment.name,
        providerOrderId: order.orderId,
        qrData: order.qrData,
        status: 'PAYMENT_PENDING',
      },
    });

    // Update job status
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: 'PAYMENT_PENDING' },
    });

    res.json({
      success: true,
      data: {
        paymentId: paymentRecord.id,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        qrData: order.qrData,
        upiLink: order.upiLink,
        redirectUrl: order.redirectUrl || order.qrData,
        expiresAt: order.expiresAt,
      },
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment' });
  }
});

// Optional callback route when returning from hosted payment gateway
router.all('/callback', async (req: Request, res: Response) => {
  const query = req.query;
  const body = req.body;
  const jobId = (query.jobId || body?.jobId || '') as string;
  const displayId = (query.displayId || body?.displayId || '') as string;
  const orderId = (query.orderId || body?.orderId || '') as string;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return res.redirect(`${appUrl}/payment?jobId=${jobId}&displayId=${displayId}&orderId=${orderId}&callback=true`);
});

// Verify payment
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const prisma = req.app.locals.prisma;
    const paymentProvider = req.app.locals.payment;
    const io = req.app.locals.io;
    const { paymentId, orderId, jobId, paymentData } = req.body;

    // Find payment record
    const paymentRecord = await prisma.payment.findFirst({
      where: paymentId
        ? { id: paymentId }
        : orderId
        ? { providerOrderId: orderId }
        : jobId
        ? { jobId }
        : { id: '__non_existent__' },
      include: { job: true },
    });

    if (!paymentRecord) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (paymentRecord.status === 'PAID') {
      return res.json({
        success: true,
        data: { verified: true, status: 'PAID', message: 'Already verified' },
      });
    }

    // Verify with payment provider — NEVER TRUST FRONTEND
    const verification = await paymentProvider.verifyPayment(
      paymentRecord.providerOrderId,
      paymentData || {}
    );

    // Update payment record
    await prisma.payment.update({
      where: { id: paymentRecord.id },
      data: {
        status: verification.status,
        providerRef: verification.providerRef,
        verifiedAt: verification.verified ? new Date() : null,
      },
    });

    if (verification.verified) {
      // Update job status
      await prisma.printJob.update({
        where: { id: paymentRecord.jobId },
        data: { status: 'PAID' },
      });

      // Notify customer via WebSocket
      io.to(`session:${paymentRecord.job.sessionId}`).emit('payment_verified', {
        type: 'PAYMENT_VERIFIED',
        jobId: paymentRecord.jobId,
        displayId: paymentRecord.job.displayId,
        status: 'PAID',
        amount: paymentRecord.amount,
      });

      // Notify Real-Time Admin Portal
      io.to('admin').emit('job_updated', {
        id: paymentRecord.jobId,
        displayId: paymentRecord.job.displayId,
        status: 'PAID',
        paymentStatus: 'PAID',
        totalPrice: paymentRecord.amount,
      });

      // For QR flow: auto-queue the job
      if (paymentRecord.job.printMethod === 'QR' && paymentRecord.job.kioskId) {
        await prisma.printJob.update({
          where: { id: paymentRecord.jobId },
          data: { status: 'QUEUED' },
        });

        // Get signed URL for the file
        const file = await prisma.file.findUnique({ where: { id: paymentRecord.job.fileId } });
        const storage = req.app.locals.storage;
        const downloadUrl = await storage.getSignedUrl(file!.storageKey, 600);

        // Notify kiosk via WebSocket
        io.to(`kiosk:${paymentRecord.job.kioskId}`).emit('new_job', {
          type: 'NEW_JOB',
          job: paymentRecord.job,
          downloadUrl,
          downloadExpiresAt: new Date(Date.now() + 600000).toISOString(),
        });
      }

      await prisma.auditLog.create({
        data: {
          action: 'PAYMENT_VERIFIED',
          entityType: 'Payment',
          entityId: paymentRecord.id,
          details: JSON.stringify({ amount: verification.amount, provider: paymentRecord.provider }),
        },
      });
    }

    res.json({
      success: true,
      data: {
        verified: verification.verified,
        status: verification.status,
        paymentId: paymentRecord.id,
        jobId: paymentRecord.jobId,
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

export { router as paymentRoutes };
