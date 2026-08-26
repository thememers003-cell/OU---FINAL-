// ============================================================
// XPOS Queue — BullMQ job queue management
// ============================================================

import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

// ── Print Job Queue ──
export function createPrintJobQueue(): Queue {
  return new Queue('xpos:print-jobs', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });
}

// ── File Cleanup Queue ──
export function createFileCleanupQueue(): Queue {
  return new Queue('xpos:file-cleanup', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: { count: 20 },
    },
  });
}

// ── Code Expiry Queue ──
export function createCodeExpiryQueue(): Queue {
  return new Queue('xpos:code-expiry', {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: { count: 20 },
    },
  });
}

// ── Worker Factory ──
export function createWorker(
  queueName: string,
  processor: (job: any) => Promise<any>,
  concurrency: number = 1
): Worker {
  return new Worker(queueName, processor, {
    connection: getRedisConnection(),
    concurrency,
  });
}

// ── Queue Events ──
export function createQueueEvents(queueName: string): QueueEvents {
  return new QueueEvents(queueName, {
    connection: getRedisConnection(),
  });
}

export { Queue, Worker, QueueEvents };
