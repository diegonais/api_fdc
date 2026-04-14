import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DetectionSourceType } from '../entities/detection.entity';

export class FindDetectionsQueryDto {
  @ApiPropertyOptional({
    enum: DetectionSourceType,
    description: 'Filtra por tipo de fuente de deteccion.',
    example: DetectionSourceType.VIIRS,
  })
  @IsOptional()
  @IsEnum(DetectionSourceType)
  source?: DetectionSourceType;

  @ApiPropertyOptional({
    description: 'Fecha inicial de adquisicion (inclusive) en formato YYYY-MM-DD.',
    format: 'date',
    example: '2026-04-01',
  })
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Fecha final de adquisicion (inclusive) en formato YYYY-MM-DD.',
    format: 'date',
    example: '2026-04-14',
  })
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  date_to?: string;

  @ApiPropertyOptional({
    description:
      'Confianza minima numerica (0-100). Solo aplica cuando confidence es numerica.',
    minimum: 0,
    maximum: 100,
    example: 80,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Max(100)
  min_confidence?: number;

  @ApiPropertyOptional({
    description: 'Filtra por satelite exacto.',
    example: 'NOAA-20',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/\S/u)
  satellite?: string;

  @ApiPropertyOptional({
    description: 'Pagina solicitada para paginacion.',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por pagina.',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
