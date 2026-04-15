import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { type Logger as PinoLogger } from 'pino';
import { DataSource } from 'typeorm';
import { parseBoolean } from '../config/parse-env.util';
import { Detection } from '../detections/entities/detection.entity';
import { AppLogger } from '../logger/app-logger.service';
import { SyncFirmsDto } from './dto/sync-firms.dto';
import { FIRMS_MAX_DAY_RANGE } from './firms.constants';
import { FirmsSettings, getFirmsSettings } from './firms.config';
import { FirmsClient } from './firms.client';
import { FirmsMapper } from './firms.mapper';
import {
  FirmsSyncSummary,
  PreparedDetectionRecord,
  SourceSyncResult,
} from './firms.types';

const FIRMS_INCREMENTAL_SYNC_JOB_NAME = 'firms_incremental_sync';
const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;

type IncrementalSyncTrigger = 'boot' | 'cron';
type InitialSyncTrigger = 'startup' | 'script';

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
  private readonly logger: PinoLogger;
  private isIncrementalSyncRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly firmsClient: FirmsClient,
    private readonly firmsMapper: FirmsMapper,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly appLogger: AppLogger,
  ) {
    this.logger = this.appLogger.child({
      context: FirmsIngestionService.name,
    });
  }

  async onModuleInit(): Promise<void> {
    const settings = getFirmsSettings(this.configService);
    const timezone = this.resolveTimezone();
    const cronDisabled = parseBoolean(this.configService.get('FIRMS_DISABLE_CRON'));

    if (cronDisabled) {
      this.logger.warn(
        { timezone },
        'FIRMS cron startup skipped because FIRMS_DISABLE_CRON=true.',
      );
      return;
    }

    const shouldRunInitialSync = await this.shouldRunInitialSync();

    if (shouldRunInitialSync) {
      await this.runInitialSyncFromConfiguredDate('startup', settings, timezone);
    } else {
      this.logger.info(
        'Detections already exist. Skipping initial FIRMS sync from configured date.',
      );
    }

    this.registerAndStartIncrementalCron(settings, timezone);

    if (settings.runOnBoot && !shouldRunInitialSync) {
      void this.runIncrementalSync('boot');
    }
  }

  async runInitialSyncFromConfiguredDate(
    trigger: InitialSyncTrigger = 'script',
    settings = getFirmsSettings(this.configService),
    timezone = this.resolveTimezone(),
  ): Promise<void> {
    const startDate = this.parseIsoDate(settings.initialSyncStartDate);
    const today = this.parseIsoDate(this.getTodayIsoDate(timezone));

    if (startDate.getTime() > today.getTime()) {
      this.logger.warn(
        {
          trigger,
          initialSyncStartDate: this.formatIsoDate(startDate),
          timezone,
          today: this.formatIsoDate(today),
        },
        'Skipping FIRMS initial sync because FIRMS_INITIAL_SYNC_START_DATE is in the future.',
      );
      return;
    }

    const totalDays = this.calculateDayDifference(startDate, today) + 1;
    const totalWindows = Math.ceil(totalDays / FIRMS_MAX_DAY_RANGE);
    let cursor = startDate;
    let completedWindows = 0;
    let fetchedCount = 0;
    let insertedCount = 0;
    let duplicateCount = 0;
    let failedSources = 0;
    const startedAt = Date.now();

    this.logger.info(
      {
        trigger,
        initialSyncStartDate: this.formatIsoDate(startDate),
        finalDate: this.formatIsoDate(today),
        totalDays,
        maxWindowDays: FIRMS_MAX_DAY_RANGE,
        totalWindows,
        sources: settings.enabledSources,
      },
      'Starting FIRMS initial sync from configured date.',
    );

    while (cursor.getTime() <= today.getTime()) {
      const daysRemaining = this.calculateDayDifference(cursor, today) + 1;
      const dayRange = Math.min(daysRemaining, FIRMS_MAX_DAY_RANGE);
      const windowStartDate = this.formatIsoDate(cursor);

      completedWindows += 1;
      this.logger.info(
        {
          trigger,
          window: completedWindows,
          totalWindows,
          startDate: windowStartDate,
          dayRange,
        },
        'Running FIRMS initial sync window.',
      );

      const summary = await this.runManualSync({
        sources: settings.enabledSources,
        dayRange,
        startDate: windowStartDate,
      });

      fetchedCount += summary.totals.fetchedCount;
      insertedCount += summary.totals.insertedCount;
      duplicateCount += summary.totals.duplicateCount;
      failedSources += summary.totals.failedSources;
      cursor = this.addDays(cursor, dayRange);
    }

    const durationMs = Date.now() - startedAt;
    this.logger.info(
      {
        trigger,
        completedWindows,
        totalWindows,
        fetched: fetchedCount,
        inserted: insertedCount,
        duplicates: duplicateCount,
        failedSources,
        durationMs,
      },
      'Finished FIRMS initial sync from configured date.',
    );
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

    const summary: FirmsSyncSummary = {
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

    await this.recordSuccessfulIngestionRun(summary);

    return summary;
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

  private registerAndStartIncrementalCron(
    settings: FirmsSettings,
    timezone: string,
  ): void {
    const cronExpression = this.buildCronExpression(settings.syncEveryMinutes);

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
  }

  private async shouldRunInitialSync(): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `
        SELECT 1
        FROM detections
        LIMIT 1
      `,
    )) as unknown[];

    return rows.length === 0;
  }

  private resolveTimezone(): string {
    return String(this.configService.get('TZ') ?? 'America/La_Paz');
  }

  private getTodayIsoDate(timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('Could not determine current date for initial FIRMS sync.');
    }

    return `${year}-${month}-${day}`;
  }

  private parseIsoDate(value: string): Date {
    const normalized = value.trim().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new Error(`Invalid ISO date value: "${value}"`);
    }

    const [year, month, day] = normalized.split('-').map((part) => Number(part));
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (this.formatIsoDate(parsed) !== normalized) {
      throw new Error(`Invalid ISO date value: "${value}"`);
    }

    return parsed;
  }

  private formatIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private addDays(baseDate: Date, days: number): Date {
    return new Date(baseDate.getTime() + days * MILLISECONDS_IN_A_DAY);
  }

  private calculateDayDifference(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / MILLISECONDS_IN_A_DAY);
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

  private async recordSuccessfulIngestionRun(
    summary: FirmsSyncSummary,
  ): Promise<void> {
    if (summary.totals.insertedCount <= 0 || summary.totals.failedSources > 0) {
      return;
    }

    try {
      await this.dataSource.query(
        `
          INSERT INTO ingestion_runs (
            pipeline,
            sources,
            day_range,
            start_date,
            fetched_count,
            inserted_count,
            duplicate_count
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          'FIRMS',
          summary.requested.sources,
          summary.requested.dayRange,
          summary.requested.startDate ?? null,
          summary.totals.fetchedCount,
          summary.totals.insertedCount,
          summary.totals.duplicateCount,
        ],
      );
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : String(error),
          sources: summary.requested.sources,
          dayRange: summary.requested.dayRange,
          startDate: summary.requested.startDate,
          fetched: summary.totals.fetchedCount,
          inserted: summary.totals.insertedCount,
          duplicates: summary.totals.duplicateCount,
        },
        'Failed to register a successful ingestion run.',
      );
    }
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
