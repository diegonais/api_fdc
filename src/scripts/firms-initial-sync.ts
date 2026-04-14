import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FirmsIngestionService } from '../firms/firms.ingestion.service';

async function run(): Promise<void> {
  process.env.FIRMS_DISABLE_CRON = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  try {
    const firmsIngestionService = app.get(FirmsIngestionService);
    await firmsIngestionService.runInitialSyncFromConfiguredDate('script');
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  // Fallback log in case app logger is not available in this context.
  console.error('Initial FIRMS sync script failed:', error);
  process.exit(1);
});
