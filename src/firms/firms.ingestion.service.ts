import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Detection } from '../detections/entities/detection.entity';
import { getFirmsSettings } from './firms.config';
import { FirmsClient } from './firms.client';
import { FirmsMapper } from './firms.mapper';
import { SyncFirmsDto } from './dto/sync-firms.dto';
import {
  FirmsSyncSummary,
  PreparedDetectionRecord,
  SourceSyncResult,
} from './firms.types';

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
export class FirmsIngestionService {
  private readonly logger = new Logger(FirmsIngestionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly firmsClient: FirmsClient,
    private readonly firmsMapper: FirmsMapper,
  ) {}

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
        this.logger.error(
          `FIRMS sync failed for ${source}`,
          error instanceof Error ? error.stack : String(error),
        );
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
