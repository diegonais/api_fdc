import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { FIRMS_MAX_DAY_RANGE, FirmsSource } from '../firms.constants';

export class SyncFirmsDto {
  @ApiPropertyOptional({
    enum: FirmsSource,
    isArray: true,
    description:
      'Fuentes FIRMS a sincronizar. Si se omite, usa FIRMS_ENABLED_SOURCES del entorno.',
    example: [FirmsSource.VIIRS_SNPP_NRT, FirmsSource.MODIS_NRT],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(FirmsSource, { each: true })
  sources?: FirmsSource[];

  @ApiPropertyOptional({
    description:
      'Cantidad de dias a consultar (maximo definido por FIRMS). Si se omite, usa FIRMS_LOOKBACK_DAYS.',
    minimum: 1,
    maximum: FIRMS_MAX_DAY_RANGE,
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FIRMS_MAX_DAY_RANGE)
  dayRange?: number;

  @ApiPropertyOptional({
    description:
      'Fecha de inicio opcional en formato YYYY-MM-DD. Si se envia, FIRMS toma este dia como referencia.',
    format: 'date',
    example: '2026-04-10',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
}
