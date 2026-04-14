import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FirmsIngestionService } from './firms.ingestion.service';
import { SyncFirmsDto } from './dto/sync-firms.dto';
import { SyncFirmsResponseDto } from './dto/sync-firms-response.dto';

@ApiTags('FIRMS Sync')
@Controller('firms')
export class FirmsController {
  constructor(private readonly firmsIngestionService: FirmsIngestionService) {}

  @ApiOperation({
    summary: 'Ejecutar sincronizacion manual con NASA FIRMS',
    description:
      'Permite disparar una sincronizacion manual para una o varias fuentes. Si no se envian parametros, usa la configuracion del entorno.',
  })
  @ApiBody({
    type: SyncFirmsDto,
    required: false,
    description: 'Parametros opcionales para controlar la ventana y fuentes a sincronizar.',
  })
  @ApiOkResponse({
    description: 'Resumen de la sincronizacion manual.',
    type: SyncFirmsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parametros invalidos en el payload.',
    schema: {
      example: {
        statusCode: 400,
        message: ['dayRange must not be greater than 5'],
        error: 'Bad Request',
      },
    },
  })
  @Post('sync')
  sync(@Body() payload: SyncFirmsDto = {}) {
    return this.firmsIngestionService.runManualSync(payload);
  }
}
