// ============================================================
// XPOS Printer — Service abstraction + Mock implementation
// ============================================================

import { EventEmitter } from 'events';
import type {
  PrinterInfo,
  PrinterStatus,
  PrintJobRequest,
  PrintJobResult,
  PrintJobProgress,
} from '@xpos/types';

// ── Printer Service Interface ──
export interface PrinterService extends EventEmitter {
  getPrinters(): Promise<PrinterInfo[]>;
  getDefaultPrinter(): Promise<PrinterInfo | null>;
  getPrinterStatus(printerId?: string): Promise<PrinterStatus>;
  submitPrintJob(job: PrintJobRequest): Promise<PrintJobResult>;
  cancelPrintJob(jobId: string): Promise<void>;
  getPrintJobStatus(jobId: string): Promise<PrintJobProgress | null>;
}

// ── Mock Printer Service ──
export class MockPrinterService extends EventEmitter implements PrinterService {
  private status: PrinterStatus = 'READY';
  private activeJobs = new Map<string, { progress: PrintJobProgress; timer?: NodeJS.Timeout }>();
  private jobCounter = 0;
  private pageDelayMs: number;

  constructor() {
    super();
    this.pageDelayMs = parseInt(process.env.MOCK_PRINT_PAGE_DELAY_MS || '1000');
  }

  async getPrinters(): Promise<PrinterInfo[]> {
    return [
      {
        id: 'mock-printer-1',
        name: 'XPOS Mock Printer',
        isDefault: true,
        status: this.status,
      },
    ];
  }

  async getDefaultPrinter(): Promise<PrinterInfo | null> {
    return {
      id: 'mock-printer-1',
      name: 'XPOS Mock Printer',
      isDefault: true,
      status: this.status,
    };
  }

  async getPrinterStatus(): Promise<PrinterStatus> {
    return this.status;
  }

  async submitPrintJob(job: PrintJobRequest): Promise<PrintJobResult> {
    if (this.status === 'OFFLINE' || this.status === 'ERROR' || this.status === 'OUT_OF_PAPER') {
      return {
        jobId: '',
        status: 'FAILED',
        error: `Printer is ${this.status}`,
      };
    }

    const jobId = `mock_print_${++this.jobCounter}`;
    const totalPages = (job.totalPages && job.totalPages > 0)
      ? job.totalPages
      : (job.pageRange ? this.countPagesFromRange(job.pageRange) : 1);

    this.status = 'PRINTING';

    const totalPrintPages = totalPages * (job.copies || 1);

    const progress: PrintJobProgress = {
      jobId,
      status: 'PRINTING',
      currentPage: 0,
      totalPages: totalPrintPages,
    };

    this.activeJobs.set(jobId, { progress });

    // Simulate page-by-page printing
    this.simulatePrinting(jobId, totalPrintPages);

    return { jobId, status: 'SUBMITTED' };
  }

  private simulatePrinting(jobId: string, totalPages: number): void {
    let currentPage = 0;
    const interval = setInterval(() => {
      currentPage++;
      const jobData = this.activeJobs.get(jobId);
      if (!jobData) {
        clearInterval(interval);
        return;
      }

      jobData.progress.currentPage = currentPage;
      this.emit('progress', { ...jobData.progress });

      if (currentPage >= totalPages) {
        clearInterval(interval);
        jobData.progress.status = 'READY';
        this.status = 'READY';
        this.emit('completed', { jobId, status: 'READY', currentPage: totalPages, totalPages });
        this.activeJobs.delete(jobId);
      }
    }, this.pageDelayMs);

    const jobData = this.activeJobs.get(jobId);
    if (jobData) {
      jobData.timer = interval;
    }
  }

  private countPagesFromRange(range: string): number {
    let count = 0;
    const parts = range.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        count += end - start + 1;
      } else {
        count += 1;
      }
    }
    return count;
  }

  async cancelPrintJob(jobId: string): Promise<void> {
    const jobData = this.activeJobs.get(jobId);
    if (jobData?.timer) {
      clearInterval(jobData.timer);
    }
    this.activeJobs.delete(jobId);
    this.status = 'READY';
    this.emit('cancelled', { jobId });
  }

  async getPrintJobStatus(jobId: string): Promise<PrintJobProgress | null> {
    return this.activeJobs.get(jobId)?.progress || null;
  }

  // Test helpers
  setStatus(status: PrinterStatus): void {
    this.status = status;
    this.emit('status_change', status);
  }
}

import { SavaPagePrinterService } from './savapage';
import { PrintpapiPrinterService } from './printpapi';
import { WindowsPrinterService } from './windows';

// ── Factory ──
export function createPrinterService(): PrinterService {
  const service = process.env.PRINTER_SERVICE || (process.platform === 'win32' ? 'windows' : 'printpapi');
  switch (service) {
    case 'windows':
      return new WindowsPrinterService(process.env.WINDOWS_PRINTER_NAME);
    case 'savapage':
      return new SavaPagePrinterService();
    case 'printpapi':
      return new PrintpapiPrinterService();
    case 'mock':
      return new MockPrinterService();
    default:
      return process.platform === 'win32'
        ? new WindowsPrinterService(process.env.WINDOWS_PRINTER_NAME)
        : new MockPrinterService();
  }
}

export { SavaPagePrinterService, PrintpapiPrinterService, WindowsPrinterService };
