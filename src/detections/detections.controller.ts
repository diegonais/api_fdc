import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DetectionsService } from './detections.service';
import { DetectionIdParamDto } from './dto/detection-id-param.dto';
import { FindDetectionsQueryDto } from './dto/find-detections-query.dto';
import {
  DetectionDetailDto,
  DetectionDetailResponseDto,
  DetectionSummaryResponseDto,
  FindDetectionsResponseDto,
  ModisDetailDto,
  ViirsDetailDto,
} from './dto/find-detections-response.dto';

@ApiTags('Detections')
@ApiExtraModels(DetectionDetailDto, ViirsDetailDto, ModisDetailDto)
@Controller('detections')
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

  @ApiOperation({ summary: 'Obtener resumen agregado de detecciones' })
  @ApiOkResponse({
    description: 'Resumen agregado obtenido correctamente.',
    type: DetectionSummaryResponseDto,
  })
  @Get('stats/summary')
  getSummary() {
    return this.detectionsService.getSummary();
  }

  @ApiOperation({
    summary:
      'Descargar un archivo Excel con las tablas detections, viirs_details y modis_details',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOkResponse({
    description:
      'Archivo Excel con 3 hojas: detections, viirs_details y modis_details.',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @Get('export/excel')
  async exportExcel(@Res() res: Response) {
    const { fileName, fileContent } =
      await this.detectionsService.buildExcelExport();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileContent);
  }

  @ApiOperation({ summary: 'Obtener una deteccion por su identificador' })
  @ApiOkResponse({
    description: 'Detalle de una deteccion obtenido correctamente.',
    type: DetectionDetailResponseDto,
  })
  @ApiBadRequestResponse({ description: 'El identificador es invalido.' })
  @ApiNotFoundResponse({ description: 'La deteccion no existe.' })
  @Get(':id')
  findOne(@Param() params: DetectionIdParamDto) {
    return this.detectionsService.findOne(params.id);
  }
}
