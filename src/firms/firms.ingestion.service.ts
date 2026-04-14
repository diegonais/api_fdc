import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import pino, { type Logger as PinoLogger } from 'pino';
import { DataSource } from 'typeorm';
import { Detection } from '../detections/entities/detection.entity';
import { SyncFirmsDto } from './dto/sync-firms.dto';
import { getFirmsSettings } from './firms.config';
import { FirmsClient } from './firms.client';
import { FirmsMapper } from './firms.mapper';
import {
  FirmsSyncSummary,
  PreparedDetectionRecord,
  SourceSyncResult,
} from './firms.types';

const FIRMS_INCREMENTAL_SYNC_JOB_NAME = 'firms_incremental_sync';

type IncrementalSyncTrigger = 'boot' | 'cron';

type DetectionIdLookupRow = {
  dedupe_key: string;
  id: string;
};

type PersistedSourceTotals = {
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
};

@Injectable()
export class FirmsIngestionService implements OnModuleInit {
  private readonly logger: PinoLogger = pino({
    name: FirmsIngestionService.name,
    level: process.env.LOG_LEVEL ?? 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:dd/mm/yyyy, h:MM:ss TT',
              ignore: 'pid,hostname',
              singleLine: true,
            },
          },
  });
  private isIncrementalSyncRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly firmsClient: FirmsClient,
    private readonly firmsMapper: FirmsMapper,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const settings = getFirmsSettings(this.configService);
    const cronExpression = this.buildCronExpression(settings.syncEveryMinutes);
    const timezone = String(this.configService.get('TZ') ?? 'America/La_Paz');

    if (this.schedulerRegistry.doesExist('cron', FIRMS_INCREMENTAL_SYNC_JOB_NAME)) {
      this.schedulerRegistry.deleteCronJob(FIRMS_INCREMENTAL_SYNC_JOB_NAME);
    }

    const incrementalSyncJob = new CronJob(
      cronExpression,
      () => {
        void this.runIncrementalSync('cron');
      },
      null,
      false,
      timezone,
    );

    this.schedulerRegistry.addCronJob(
      FIRMS_INCREMENTAL_SYNC_JOB_NAME,
      incrementalSyncJob,
    );
    incrementalSyncJob.start();

    this.logger.info(
      {
        cronExpression,
        syncEveryMinutes: settings.syncEveryMinutes,
        dayRange: settings.lookbackDays,
        bbox: settings.bbox,
        sources: settings.enabledSources,
        timezone,
      },
      'FIRMS incremental cron job started.',
    );

    if (settings.runOnBoot) {
      void this.runIncrementalSync('boot');
    }
  }

  async runManualSync(options: SyncFirmsDto = {}): Promise<FirmsSyncSummary> {
    const settings = getFirmsSettings(this.configService);
    const sources =
      options.sources && options.sources.length > 0
        ? [...new Set(options.sources)]
        : settings.enabledSources;
    const dayRange = options.dayRange ?? settings.lookbackDays;
    const startDate = options.startDate;
    const bySource: SourceSyncResult[] = [];
    let fetchedCount = 0;
    let insertedCount = 0;
    let duplicateCount = 0;

    for (const source of sources) {
      try {
        const rawRows = await this.firmsClient.fetchDetections(
          source,
          dayRange,
          startDate,
        );
        const preparedRows = this.firmsMapper.mapRows(source, rawRows);
        const persistedResult = await this.persistPreparedRows(preparedRows);

        fetchedCount += persistedResult.fetchedCount;
        insertedCount += persistedResult.insertedCount;
        duplicateCount += persistedResult.duplicateCount;

        bySource.push({
          source,
          ...persistedResult,
        });
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error(
            {
              source,
              dayRange,
              startDate,
              err: error,
            },
            `FIRMS sync failed for ${source}`,
          );
        } else {
          this.logger.error(
            {
              source,
              dayRange,
              startDate,
              err: String(error),
            },
            `FIRMS sync failed for ${source}`,
          );
        }

        bySource.push({
          source,
          fetchedCount: 0,
          insertedCount: 0,
          duplicateCount: 0,
          error: this.getErrorMessage(error),
        });
      }
    }

    return {
      requested: {
        sources,
        dayRange,
        startDate,
      },
      totals: {
        fetchedCount,
        insertedCount,
        duplicateCount,
        failedSources: bySource.filter((result) => Boolean(result.error)).length,
      },
      bySource,
    };
  }

  private async runIncrementalSync(trigger: IncrementalSyncTrigger): Promise<void> {
    if (this.isIncrementalSyncRunning) {
      this.logger.warn(
        { trigger },
        'Skipping FIRMS incremental sync because a previous run is still in progress.',
      );
      return;
    }

    this.isIncrementalSyncRunning = true;
    const startedAt = Date.now();
    const settings = getFirmsSettings(this.configService);

    this.logger.info(
      {
        trigger,
        dayRange: settings.lookbackDays,
        bbox: settings.bbox,
        sources: settings.enabledSources,
      },
      `Starting FIRMS incremental sync for the last ${settings.lookbackDays} day(s).`,
    );

    try {
      const summary = await this.runManualSync({
        sources: settings.enabledSources,
        dayRange: settings.lookbackDays,
      });

      for (const sourceResult of summary.bySource) {
        if (sourceResult.error) {
          this.logger.error(
            {
              trigger,
              source: sourceResult.source,
              fetched: sourceResult.fetchedCount,
              inserted: sourceResult.insertedCount,
              duplicates: sourceResult.duplicateCount,
              error: sourceResult.error,
            },
            `FIRMS ${sourceResult.source} failed.`,
          );
          continue;
        }

        this.logger.info(
          {
            trigger,
            source: sourceResult.source,
            fetched: sourceResult.fetchedCount,
            inserted: sourceResult.insertedCount,
            duplicates: sourceResult.duplicateCount,
          },
          `FIRMS ${sourceResult.source} fetched=${sourceResult.fetchedCount}, inserted=${sourceResult.insertedCount}, duplicates=${sourceResult.duplicateCount}`,
        );
      }

      const status = summary.totals.failedSources > 0 ? 'PARTIAL_FAILED' : 'SUCCEEDED';
      const durationMs = Date.now() - startedAt;
      this.logger.info(
        {
          trigger,
          status,
          fetched: summary.totals.fetchedCount,
          inserted: summary.totals.insertedCount,
          duplicates: summary.totals.duplicateCount,
          failedSources: summary.totals.failedSources,
          durationMs,
        },
        `Finished FIRMS incremental sync for the last ${settings.lookbackDays} day(s). status=${status}, fetched=${summary.totals.fetchedCount}, inserted=${summary.totals.insertedCount}, duplicates=${summary.totals.duplicateCount}, durationMs=${durationMs}.`,
      );
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (error instanceof Error) {
        this.logger.error(
          {
            trigger,
            durationMs,
            err: error,
          },
          'FIRMS incremental sync crashed unexpectedly.',
        );
      } else {
        this.logger.error(
          {
            trigger,
            durationMs,
            err: String(error),
          },
          'FIRMS incremental sync crashed unexpectedly.',
        );
      }
    } finally {
      this.isIncrementalSyncRunning = false;
    }
  }

  private buildCronExpression(syncEveryMinutes: number): string {
    if (syncEveryMinutes === 1) {
      return '* * * * *';
    }

    return `*/${syncEveryMinutes} * * * *`;
  }

  private async persistPreparedRows(
    preparedRows: PreparedDetectionRecord[],
  ): Promise<PersistedSourceTotals> {
    if (preparedRows.length === 0) {
      return {
        fetchedCount: 0,
        insertedCount: 0,
        duplicateCount: 0,
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const insertResult = await manager
        .createQueryBuilder()
        .insert()
        .into(Detection)
        .values(preparedRows.map((row) => row.detection))
        .orIgnore()
        .returning(['id', 'dedupe_key'])
        .execute();

      const insertedRows = Array.isArray(insertResult.raw)
        ? (insertResult.raw as DetectionIdLookupRow[])
        : [];
      const insertedCount = insertedRows.length;
      const detectionIdsByDedupe = await this.findDetectionIdsByDedupeKeys(
        manager,
        preparedRows.map((row) => row.dedupeKey),
      );
      const viirsDetails = preparedRows.flatMap((row) => {
        const detectionId = detectionIdsByDedupe.get(row.dedupeKey);

        if (!detectionId || !row.viirsDetail) return [];

        return [
          {
            detection_id: detectionId,
            bright_ti4: row.viirsDetail.brightTi4,
            bright_ti5: row.viirsDetail.brightTi5,
          },
        ];
      });
      const modisDetails = preparedRows.flatMap((row) => {
        const detectionId = detectionIdsByDedupe.get(row.dedupeKey);

        if (!detectionId || !row.modisDetail) return [];

        return [
          {
            detection_id: detectionId,
            brightness: row.modisDetail.brightness,
            bright_t31: row.modisDetail.brightT31,
          },
        ];
      });

      if (viirsDetails.length > 0) {
        await this.insertViirsDetails(manager, viirsDetails);
      }

      if (modisDetails.length > 0) {
        await this.insertModisDetails(manager, modisDetails);
      }

      return {
        fetchedCount: preparedRows.length,
        insertedCount,
        duplicateCount: preparedRows.length - insertedCount,
      };
    });
  }

  private async findDetectionIdsByDedupeKeys(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    dedupeKeys: string[],
  ): Promise<Map<string, string>> {
    const uniqueDedupeKeys = [...new Set(dedupeKeys)];

    if (uniqueDedupeKeys.length === 0) return new Map();

    const rows = (await manager.query(
      `
        SELECT id, dedupe_key
        FROM detections
        WHERE dedupe_key = ANY($1)
      `,
      [uniqueDedupeKeys],
    )) as DetectionIdLookupRow[];

    return new Map(rows.map((row) => [row.dedupe_key, row.id]));
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;

    return 'Unknown FIRMS ingestion error';
  }

  private async insertViirsDetails(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    rows: Array<{
      detection_id: string;
      bright_ti4: string;
      bright_ti5: string;
    }>,
  ): Promise<void> {
    const valuesSql = rows
      .map(
        (_, index) =>
          `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
      )
      .join(', ');
    const params = rows.flatMap((row) => [
      row.detection_id,
      row.bright_ti4,
      row.bright_ti5,
    ]);

    await manager.query(
      `
        INSERT INTO viirs_details (detection_id, bright_ti4, bright_ti5)
        VALUES ${valuesSql}
        ON CONFLICT (detection_id) DO NOTHING
      `,
      params,
    );
  }

  private async insertModisDetails(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    rows: Array<{
      detection_id: string;
      brightness: string;
      bright_t31: string;
    }>,
  ): Promise<void> {
    const valuesSql = rows
      .map(
        (_, index) =>
          `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
      )
      .join(', ');
    const params = rows.flatMap((row) => [
      row.detection_id,
      row.brightness,
      row.bright_t31,
    ]);

    await manager.query(
      `
        INSERT INTO modis_details (detection_id, brightness, bright_t31)
        VALUES ${valuesSql}
        ON CONFLICT (detection_id) DO NOTHING
      `,
      params,
    );
  }
}
