import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @ApiOperation({
    summary: 'Estado de salud del servicio',
    description: 'Valida conectividad con la base de datos y devuelve el estado general.',
  })
  @ApiOkResponse({
    description: 'Servicio y base de datos disponibles.',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'La base de datos no esta disponible.',
    schema: {
      example: {
        statusCode: 503,
        message: {
          status: 'error',
          services: { database: 'down' },
          timestamp: '2026-04-14T20:06:04.553Z',
        },
        error: 'Service Unavailable',
      },
    },
  })
  @Get()
  check() {
    return this.healthService.check();
  }
}
