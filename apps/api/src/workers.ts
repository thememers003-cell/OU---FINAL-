// ============================================================
// Workers — Background jobs (file cleanup, code expiry)
// ============================================================

import type { PrismaClient } from '@prisma/client';
import type { IStorageService } from '@xpos/storage';

export function startWorkers(prisma: PrismaClient, storage: IStorageService): void {
  // ── File Cleanup Worker ──
  // Runs every 5 minutes to delete old files
  const fileCleanupInterval = setInterval(async () => {
    try {
      const retentionMinutes = parseInt(process.env.FILE_RETENTION_MINUTES || '30');
      const cutoff = new Date(Date.now() - retentionMinutes * 60 * 1000);

      // Find completed/cancelled jobs with files older than retention
      const jobsToClean = await prisma.printJob.findMany({
        where: {
          status: { in: ['COMPLETED', 'CANCELLED', 'FAILED'] },
          completedAt: { lt: cutoff },
          file: { deletedAt: null },
        },
        include: { file: true },
      });

      for (const job of jobsToClean) {
        try {
          // Delete from storage
          await storage.deleteFile(job.file.storageKey);

          // Delete thumbnails
          if (job.file.thumbnailKeys) {
            try {
              const keys = JSON.parse(job.file.thumbnailKeys);
              if (Array.isArray(keys) && keys.length > 0) {
                await storage.deleteFiles(keys);
              }
            } catch {
              await storage.deleteFile(job.file.thumbnailKeys);
            }
          }

          // Mark file as deleted
          await prisma.file.update({
            where: { id: job.file.id },
            data: { deletedAt: new Date() },
          });

          console.log(`🗑️  Cleaned up file for job ${job.displayId}`);
        } catch (err) {
          console.error(`Failed to clean up file for job ${job.displayId}:`, err);
        }
      }
    } catch (error) {
      console.error('File cleanup error:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // ── Code Expiry Worker ──
  // Runs every minute to expire old print codes
  const codeExpiryInterval = setInterval(async () => {
    try {
      const result = await prisma.printCode.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: new Date() },
        },
        data: { status: 'EXPIRED' },
      });

      if (result.count > 0) {
        console.log(`⏰ Expired ${result.count} print code(s)`);
      }
    } catch (error) {
      console.error('Code expiry error:', error);
    }
  }, 60 * 1000); // Every 1 minute

  // Cleanup on process exit
  process.on('SIGTERM', () => {
    clearInterval(fileCleanupInterval);
    clearInterval(codeExpiryInterval);
  });

  process.on('SIGINT', () => {
    clearInterval(fileCleanupInterval);
    clearInterval(codeExpiryInterval);
  });
}
