import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Detection } from '../detections/entities/detection.entity';
import { IngestionRun } from '../ingestion_runs/entities/ingestion_run.entity';
import { ModisDetail } from '../modis_details/entities/modis_detail.entity';
import { ViirsDetail } from '../viirs_details/entities/viirs_detail.entity';
import { FirmsClient } from './firms.client';
import { FirmsController } from './firms.controller';
import { FirmsIngestionService } from './firms.ingestion.service';
import { FirmsMapper } from './firms.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([Detection, ViirsDetail, ModisDetail, IngestionRun]),
  ],
  controllers: [FirmsController],
  providers: [FirmsClient, FirmsMapper, FirmsIngestionService],
  exports: [FirmsClient, FirmsIngestionService],
})
export class FirmsModule {}
