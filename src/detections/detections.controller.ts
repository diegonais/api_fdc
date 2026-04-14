import { Controller, Get, Query } from '@nestjs/common';
import { DetectionsService } from './detections.service';
import { FindDetectionsQueryDto } from './dto/find-detections-query.dto';

@Controller('firms/detections')
export class DetectionsController {
  constructor(private readonly detectionsService: DetectionsService) {}

  @Get()
  findAll(@Query() query: FindDetectionsQueryDto) {
    return this.detectionsService.findAll(query);
  }
}
