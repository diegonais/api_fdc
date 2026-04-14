import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FirmsSource } from '../firms.constants';

export class SyncFirmsRequestedDto {
  @ApiProperty({
    enum: FirmsSource,
    isArray: true,
    example: [FirmsSource.VIIRS_NOAA20_NRT, FirmsSource.MODIS_NRT],
  })
  sources!: FirmsSource[];

  @ApiProperty({
    description: 'Rango de dias solicitado para FIRMS.',
    example: 4,
  })
  dayRange!: number;

  @ApiPropertyOptional({
    description:
      'Fecha de inicio opcional en formato YYYY-MM-DD. Si se envia, el rango comienza aqui.',
    format: 'date',
    example: '2026-04-10',
  })
  startDate?: string;
}

export class SyncFirmsTotalsDto {
  @ApiProperty({ example: 1200 })
  fetchedCount!: number;

  @ApiProperty({ example: 1187 })
  insertedCount!: number;

  @ApiProperty({ example: 13 })
  duplicateCount!: number;

  @ApiProperty({ example: 0 })
  failedSources!: number;
}

export class SyncFirmsSourceResultDto {
  @ApiProperty({ enum: FirmsSource, example: FirmsSource.VIIRS_NOAA20_NRT })
  source!: FirmsSource;

  @ApiProperty({ example: 800 })
  fetchedCount!: number;

  @ApiProperty({ example: 790 })
  insertedCount!: number;

  @ApiProperty({ example: 10 })
  duplicateCount!: number;

  @ApiPropertyOptional({
    description: 'Detalle de error cuando la fuente no pudo sincronizarse.',
    example: 'FIRMS request failed for MODIS_NRT with status 500',
  })
  error?: string;
}

export class SyncFirmsResponseDto {
  @ApiProperty({ type: SyncFirmsRequestedDto })
  requested!: SyncFirmsRequestedDto;

  @ApiProperty({ type: SyncFirmsTotalsDto })
  totals!: SyncFirmsTotalsDto;

  @ApiProperty({ type: [SyncFirmsSourceResultDto] })
  bySource!: SyncFirmsSourceResultDto[];
}
