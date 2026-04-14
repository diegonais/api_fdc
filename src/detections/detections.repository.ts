import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FindDetectionsQueryDto } from './dto/find-detections-query.dto';
import { Detection } from './entities/detection.entity';

type PaginatedDetectionsResult = {
  items: Detection[];
  total: number;
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
