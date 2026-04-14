import { BadRequestException, Injectable } from '@nestjs/common';
import { FindDetectionsQueryDto } from './dto/find-detections-query.dto';
import { DetectionsRepository } from './detections.repository';
import { Detection } from './entities/detection.entity';

@Injectable()
export class DetectionsService {
  constructor(private readonly detectionsRepository: DetectionsRepository) {}

  async findAll(query: FindDetectionsQueryDto) {
    this.validateDateRange(query);

    const { items, total } = await this.detectionsRepository.findAll(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      success: true,
      message: 'Detections retrieved successfully',
      data: items.map((item) => this.mapDetectionItem(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private validateDateRange(query: FindDetectionsQueryDto): void {
    if (!query.date_from || !query.date_to) return;

    if (query.date_from > query.date_to) {
      throw new BadRequestException('date_from cannot be greater than date_to');
    }
  }

  private mapDetectionItem(detection: Detection) {
    return {
      id: detection.id,
      source: detection.sourceType,
      latitude: Number(detection.latitude),
      longitude: Number(detection.longitude),
      scan: Number(detection.scan),
      track: Number(detection.track),
      acqDate: detection.acqDate,
      acqTime: detection.acqTime,
      satellite: detection.satellite,
      instrument: detection.instrument,
      confidence: detection.confidence,
      version: detection.version,
      frp: Number(detection.frp),
      daynight: detection.daynight,
      createdAt: detection.createdAt.toISOString(),
      updatedAt: detection.updatedAt.toISOString(),
    };
  }
}
