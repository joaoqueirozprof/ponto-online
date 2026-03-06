import Queue from 'bull';
import { PrismaClient } from '@prisma/client';
import { CalculationProcessor } from './processors/calculation.processor';
import { SyncProcessor } from './processors/sync.processor';

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';

const calculationQueue = new Queue('calculation', redisUrl);
const syncQueue = new Queue('sync', redisUrl);

async function initializeWorkers() {
  console.log('Initializing worker processes...');

  const calculationProcessor = new CalculationProcessor(prisma);
  const syncProcessor = new SyncProcessor(prisma);

  calculationQueue.process(async (job) => {
    console.log('Processing calculation job:', job.id);
    return await calculationProcessor.process(job);
  });

  syncQueue.process(async (job) => {
    console.log('Processing sync job:', job.id);
    return await syncProcessor.process(job);
  });

  calculationQueue.on('completed', (job) => {
    console.log(`Calculation job ${job.id} completed`);
  });

  calculationQueue.on('failed', (job, err) => {
    console.error(`Calculation job ${job.id} failed:`, err.message);
  });

  syncQueue.on('completed', (job) => {
    console.log(`Sync job ${job.id} completed`);
  });

  syncQueue.on('failed', (job, err) => {
    console.error(`Sync job ${job.id} failed:`, err.message);
  });

  console.log('Worker processes initialized successfully');
}

async function shutdown() {
  console.log('Shutting down workers...');
  await calculationQueue.close();
  await syncQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

initializeWorkers().catch((error) => {
  console.error('Failed to initialize workers:', error);
  process.exit(1);
});

export { calculationQueue, syncQueue };
