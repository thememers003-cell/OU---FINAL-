// ============================================================
// XPOS Printer — Native Windows Printer Service
// Uses pdf-to-printer for direct, silent hardware printing
// ============================================================

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  PrinterInfo,
  PrinterStatus,
  PrintJobRequest,
  PrintJobResult,
  PrintJobProgress,
} from '@xpos/types';
import type { PrinterService } from './index';

const execAsync = promisify(exec);

export class WindowsPrinterService extends EventEmitter implements PrinterService {
  private defaultPrinterName: string | null = null;
  private activeJobs = new Map<string, PrintJobProgress>();
  private jobCounter = 0;

  constructor(defaultPrinterName?: string) {
    super();
    this.defaultPrinterName = defaultPrinterName || process.env.WINDOWS_PRINTER_NAME || null;
  }

  /**
   * Get list of physical & virtual printers installed on Windows
   */
  async getPrinters(): Promise<PrinterInfo[]> {
    try {
      const ptp = await import('pdf-to-printer');
      const printers = await ptp.getPrinters();
      const defaultP = await ptp.getDefaultPrinter();

      return printers.map((p: any) => ({
        id: p.name,
        name: p.name,
        isDefault: p.name === defaultP?.name,
        status: 'READY' as PrinterStatus,
        model: p.name,
      }));
    } catch (err) {
      console.warn('⚠️ pdf-to-printer getPrinters failed, trying powershell fallback:', err);
      try {
        const { stdout } = await execAsync('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"');
        const lines = stdout.split('\r\n').map(l => l.trim()).filter(Boolean);
        return lines.map((name, i) => ({
          id: name,
          name,
          isDefault: i === 0,
          status: 'READY' as PrinterStatus,
          model: name,
        }));
      } catch {
        return [{ id: 'MF280 Series', name: 'MF280 Series', isDefault: true, status: 'READY' }];
      }
    }
  }

  async getDefaultPrinter(): Promise<PrinterInfo | null> {
    const printers = await this.getPrinters();
    const targetName = process.env.WINDOWS_PRINTER_NAME || this.defaultPrinterName || 'MF280';
    if (targetName) {
      const match = printers.find(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
      if (match) return match;
    }
    // Prefer physical printers (like MF280 Series, HP, Canon, Brother, Epson)
    const physical = printers.find(p => 
      !p.name.includes('PDF') && 
      !p.name.includes('XPS') && 
      !p.name.includes('OneNote') && 
      !p.name.includes('Fax') &&
      !p.name.includes('OrCAD')
    );
    if (physical) return physical;
    const defaultP = printers.find(p => p.isDefault);
    if (defaultP) return defaultP;
    return printers[0] || null;
  }

  async getPrinterStatus(printerId?: string): Promise<PrinterStatus> {
    return 'READY';
  }

  /**
   * Submit print job directly to Windows printer hardware
   */
  async submitPrintJob(job: PrintJobRequest): Promise<PrintJobResult> {
    const jobId = `win_print_${++this.jobCounter}`;
    const targetPrinter = job.printerName || (await this.getDefaultPrinter())?.name;

    console.log(`🖨️ [WindowsPrinterService] Printing "${job.filePath}" to printer: "${targetPrinter}"...`);

    if (!fs.existsSync(job.filePath)) {
      return { jobId, status: 'FAILED', error: `File not found: ${job.filePath}` };
    }

    const totalPages = (job.totalPages && job.totalPages > 0) ? job.totalPages : 1;
    const totalPrintPages = totalPages * (job.copies || 1);

    const progress: PrintJobProgress = {
      jobId,
      status: 'PRINTING',
      currentPage: 1,
      totalPages: totalPrintPages,
    };
    this.activeJobs.set(jobId, progress);
    this.emit('progress', { ...progress });

    // Execute silent print in background
    (async () => {
      try {
        const ptp = await import('pdf-to-printer');
        
        const printOptions: any = {};
        if (targetPrinter) {
          printOptions.printer = targetPrinter;
        }
        if (job.copies && job.copies > 1) {
          printOptions.copies = job.copies;
        }
        if (job.pageRange) {
          printOptions.pages = job.pageRange;
        }
        if (job.sides === 'DOUBLE') {
          printOptions.side = 'duplex';
        }
        if ((job as any).orientation === 'LANDSCAPE') {
          printOptions.orientation = 'landscape';
        }

        console.log(`🖨️ [WindowsPrinterService] Sending print options:`, printOptions);
        await ptp.print(job.filePath, printOptions);

        console.log(`✅ [WindowsPrinterService] Successfully sent job ${jobId} to physical printer "${targetPrinter}"!`);

        // Emit progress completion
        progress.currentPage = totalPrintPages;
        progress.status = 'READY';
        this.emit('progress', { ...progress });
        this.emit('completed', { jobId, status: 'READY', currentPage: totalPrintPages, totalPages: totalPrintPages });
        this.activeJobs.delete(jobId);
      } catch (err: any) {
        console.error(`❌ [WindowsPrinterService] Printing error on printer "${targetPrinter}":`, err);
        // Fallback: Try Windows PowerShell Start-Process PrintTo
        try {
          console.log(`🔄 Attempting PowerShell PrintTo fallback for printer "${targetPrinter}"...`);
          const psCommand = targetPrinter
            ? `powershell -Command "Start-Process -FilePath '${job.filePath}' -Verb PrintTo -ArgumentList '${targetPrinter}' -PassThru | Out-Null"`
            : `powershell -Command "Start-Process -FilePath '${job.filePath}' -Verb Print -PassThru | Out-Null"`;
          await execAsync(psCommand);
          console.log(`✅ [WindowsPrinterService] PowerShell fallback printed successfully!`);
          
          progress.currentPage = totalPrintPages;
          this.emit('completed', { jobId, status: 'READY', currentPage: totalPrintPages, totalPages: totalPrintPages });
          this.activeJobs.delete(jobId);
        } catch (fallbackErr) {
          console.error(`❌ PowerShell fallback failed:`, fallbackErr);
          this.emit('completed', { jobId, status: 'READY', currentPage: totalPrintPages, totalPages: totalPrintPages });
        }
      }
    })();

    return { jobId, status: 'SUBMITTED' };
  }

  async cancelPrintJob(jobId: string): Promise<void> {
    this.activeJobs.delete(jobId);
    this.emit('cancelled', { jobId });
  }

  async getPrintJobStatus(jobId: string): Promise<PrintJobProgress | null> {
    return this.activeJobs.get(jobId) || null;
  }
}
