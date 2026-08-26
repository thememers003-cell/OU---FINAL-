import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@xpos/types';

export class XPOSError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public httpStatus: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'XPOSError';
  }

  toCustomerError() {
    // Keep it generic for the customer
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
      code: this.code,
    };
  }

  toAdminError(req: Request) {
    // Full details for admin logs
    return {
      success: false,
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: new Date().toISOString(),
      path: req.path,
    };
  }
}

// Common error instances
export const Errors = {
  PaymentPending: new XPOSError('PAYMENT_PENDING', 'Payment is still pending', 400),
  PaymentFailed: new XPOSError('PAYMENT_FAILED', 'Payment failed', 400),
  PaymentVerificationFailed: new XPOSError('PAYMENT_VERIFICATION_FAILED', 'Could not verify payment', 400),
  PinInvalid: new XPOSError('PIN_INVALID', 'Invalid print code', 404),
  PinExpired: new XPOSError('PIN_EXPIRED', 'Print code has expired', 400),
  PinLocked: new XPOSError('PIN_LOCKED', 'Too many failed attempts. Code locked.', 429),
  QrInvalid: new XPOSError('QR_INVALID', 'Invalid QR code', 404),
  QrExpired: new XPOSError('QR_EXPIRED', 'QR code has expired', 400),
  QrAlreadyUsed: new XPOSError('QR_ALREADY_USED', 'QR code already used', 400),
  KioskOffline: new XPOSError('KIOSK_OFFLINE', 'Kiosk is offline', 503),
  PrinterOffline: new XPOSError('PRINTER_OFFLINE', 'Printer is offline', 503),
  PrinterPaperOut: new XPOSError('PRINTER_PAPER_OUT', 'Printer is out of paper', 503),
  PrinterJam: new XPOSError('PRINTER_JAM', 'Printer has a paper jam', 503),
  PrintFailed: new XPOSError('PRINT_FAILED', 'Failed to print document', 500),
  PrintPartial: new XPOSError('PRINT_PARTIAL', 'Document only partially printed', 500),
  InternalError: new XPOSError('INTERNAL_ERROR', 'Internal server error', 500),
};

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  if (err instanceof XPOSError) {
    // We could log this to the database SecurityEvent/AuditLog here if needed
    res.status(err.httpStatus).json(err.toCustomerError());
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Something went wrong. Please try again.',
    code: 'INTERNAL_ERROR'
  });
}
