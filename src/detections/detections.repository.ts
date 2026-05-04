import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FindDetectionsQueryDto } from './dto/find-detections-query.dto';
import { Detection, DetectionSourceType } from './entities/detection.entity';

type PaginatedDetectionsResult = {
  items: Detection[];
  total: number;
};

type DetectionSourceSummary = {
  source: DetectionSourceType;
  total: number;
};

type DetectionSummaryAggregate = {
  totalDetections: number;
  totalsBySource: DetectionSourceSummary[];
  averageConfidence: number | null;
  numericConfidenceCount: number;
};

export type DetectionExportRow = {
  id: string;
  source_type: DetectionSourceType;
  latitude: string;
  longitude: string;
  scan: string;
  track: string;
  acq_date: string;
  acq_time: number;
  satellite: string;
  instrument: string;
  confidence: string;
  version: string;
  frp: string;
  daynight: string;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
};

export type ViirsDetailExportRow = {
  id: string;
  detection_id: string;
  bright_ti4: string;
  bright_ti5: string;
  created_at: string;
  updated_at: string;
};

export type ModisDetailExportRow = {
  id: string;
  detection_id: string;
  brightness: string;
  bright_t31: string;
  created_at: string;
  updated_at: string;
};

export type ExcelExportDataset = {
  detections: DetectionExportRow[];
  viirsDetails: ViirsDetailExportRow[];
  modisDetails: ModisDetailExportRow[];
};

@Injectable()
export class DetectionsRepository {
  constructor(
    @InjectRepository(Detection)
    private readonly detectionRepository: Repository<Detection>,
  ) {}

  async findAll(
    filters: FindDetectionsQueryDto,
  ): Promise<PaginatedDetectionsResult> {
    const queryBuilder = this.createListQueryBuilder(filters);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
    };
  }

  async findOneById(id: string): Promise<Detection | null> {
    return this.detectionRepository.findOne({
      where: { id },
      relations: {
        viirsDetail: true,
        modisDetail: true,
      },
    });
  }

  async getSummary(): Promise<DetectionSummaryAggregate> {
    const [totalDetections, totalsBySourceRaw, confidenceSummaryRaw] =
      await Promise.all([
        this.detectionRepository.count(),
        this.detectionRepository
          .createQueryBuilder('detection')
          .select('detection.sourceType', 'source')
          .addSelect('COUNT(*)', 'total')
          .groupBy('detection.sourceType')
          .orderBy('detection.sourceType', 'ASC')
          .getRawMany<{ source: DetectionSourceType; total: string }>(),
        this.detectionRepository
          .createQueryBuilder('detection')
          .select(
            `AVG(CASE WHEN detection.confidence ~ '^[0-9]+(\\.[0-9]+)?$' THEN CAST(detection.confidence AS numeric) END)`,
            'averageConfidence',
          )
          .addSelect(
            `COUNT(CASE WHEN detection.confidence ~ '^[0-9]+(\\.[0-9]+)?$' THEN 1 END)`,
            'numericConfidenceCount',
          )
          .getRawOne<{
            averageConfidence: string | null;
            numericConfidenceCount: string;
          }>(),
      ]);

    const totalsBySource = Object.values(DetectionSourceType).map((source) => ({
      source,
      total: Number(
        totalsBySourceRaw.find((item) => item.source === source)?.total ?? 0,
      ),
    }));

    return {
      totalDetections,
      totalsBySource,
      averageConfidence: confidenceSummaryRaw?.averageConfidence
        ? Number(confidenceSummaryRaw.averageConfidence)
        : null,
      numericConfidenceCount: Number(
        confidenceSummaryRaw?.numericConfidenceCount ?? 0,
      ),
    };
  }

  async findAllForExcelExport(): Promise<ExcelExportDataset> {
    const [detections, viirsDetails, modisDetails] = await Promise.all([
      this.detectionRepository.query(`
        SELECT
          id,
          source_type,
          latitude,
          longitude,
          scan,
          track,
          acq_date,
          acq_time,
          satellite,
          instrument,
          confidence,
          version,
          frp,
          daynight,
          dedupe_key,
          created_at,
          updated_at
        FROM detections
        ORDER BY acq_date DESC, created_at DESC, id DESC
      `),
      this.detectionRepository.query(`
        SELECT
          id,
          detection_id,
          bright_ti4,
          bright_ti5,
          created_at,
          updated_at
        FROM viirs_details
        ORDER BY created_at DESC
      `),
      this.detectionRepository.query(`
        SELECT
          id,
          detection_id,
          brightness,
          bright_t31,
          created_at,
          updated_at
        FROM modis_details
        ORDER BY created_at DESC
      `),
    ]);

    return {
      detections,
      viirsDetails,
      modisDetails,
    };
  }

  private createListQueryBuilder(
    filters: FindDetectionsQueryDto,
  ): SelectQueryBuilder<Detection> {
    const queryBuilder =
      this.detectionRepository.createQueryBuilder('detection');

    if (filters.source) {
      queryBuilder.andWhere('detection.sourceType = :source', {
        source: filters.source,
      });
    }

    if (filters.satellite) {
      queryBuilder.andWhere('detection.satellite = :satellite', {
        satellite: filters.satellite,
      });
    }

    if (filters.date_from) {
      queryBuilder.andWhere('detection.acqDate >= :dateFrom', {
        dateFrom: filters.date_from,
      });
    }

    if (filters.date_to) {
      queryBuilder.andWhere('detection.acqDate <= :dateTo', {
        dateTo: filters.date_to,
      });
    }

    if (filters.min_confidence !== undefined) {
      queryBuilder.andWhere(
        `detection.confidence ~ '^[0-9]+(\\.[0-9]+)?$' AND CAST(detection.confidence AS numeric) >= :minConfidence`,
        {
          minConfidence: filters.min_confidence,
        },
      );
    }

    return queryBuilder
      .orderBy('detection.acqDate', 'DESC')
      .addOrderBy('detection.createdAt', 'DESC')
      .addOrderBy('detection.id', 'DESC');
  }
}
