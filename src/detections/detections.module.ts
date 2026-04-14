import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetectionsController } from './detections.controller';
import { DetectionsRepository } from './detections.repository';
import { DetectionsService } from './detections.service';
import { Detection } from './entities/detection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Detection])],
  controllers: [DetectionsController],
  providers: [DetectionsService, DetectionsRepository],
  exports: [DetectionsService],
})
export class DetectionsModule {}
