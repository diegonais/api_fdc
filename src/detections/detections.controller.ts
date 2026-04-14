import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DetectionsService } from './detections.service';
import { FindDetectionsQueryDto } from './dto/find-detections-query.dto';
import { FindDetectionsResponseDto } from './dto/find-detections-response.dto';

@ApiTags('Detections')
@Controller('firms/detections')
export class DetectionsController {
  constructor(private readonly detectionsService: DetectionsService) {}

  @ApiOperation({
    summary: 'Listar detecciones FIRMS',
    description:
      'Devuelve detecciones con filtros opcionales por fuente, fecha, confianza y satelite. Incluye paginacion.',
  })
  @ApiOkResponse({
    description: 'Listado de detecciones obtenido correctamente.',
    type: FindDetectionsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parametros invalidos o rango de fechas inconsistente.',
    schema: {
      example: {
        statusCode: 400,
        message: 'date_from cannot be greater than date_to',
        error: 'Bad Request',
      },
    },
  })
  @Get()
  findAll(@Query() query: FindDetectionsQueryDto) {
    return this.detectionsService.findAll(query);
  }
}
