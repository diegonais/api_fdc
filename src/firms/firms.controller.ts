import { Body, Controller, Post } from '@nestjs/common';
import { FirmsIngestionService } from './firms.ingestion.service';
import { SyncFirmsDto } from './dto/sync-firms.dto';

@Controller('firms')
export class FirmsController {
  constructor(private readonly firmsIngestionService: FirmsIngestionService) {}

  @Post('sync')
  sync(@Body() payload: SyncFirmsDto = {}) {
    return this.firmsIngestionService.runManualSync(payload);
  }
}
