import { ApiProperty } from '@nestjs/swagger';
import { DetectionSourceType } from '../entities/detection.entity';

export class DetectionItemDto {
  @ApiProperty({
    description: 'Identificador unico de la deteccion.',
    example: '2c232036-679d-4bb1-8a59-3b30b6114a2a',
  })
  id!: string;

  @ApiProperty({
    enum: DetectionSourceType,
    description: 'Tipo de fuente de deteccion.',
    example: DetectionSourceType.VIIRS,
  })
  source!: DetectionSourceType;

  @ApiProperty({ example: -17.3912 })
  latitude!: number;

  @ApiProperty({ example: -66.1597 })
  longitude!: number;

  @ApiProperty({ example: 0.41 })
  scan!: number;

  @ApiProperty({ example: 0.56 })
  track!: number;

  @ApiProperty({
    description: 'Fecha de adquisicion en formato YYYY-MM-DD.',
    format: 'date',
    example: '2026-04-14',
  })
  acqDate!: string;

  @ApiProperty({
    description: 'Hora de adquisicion en formato HHMM.',
    example: 1340,
  })
  acqTime!: number;

  @ApiProperty({ example: 'NOAA-20' })
  satellite!: string;

  @ApiProperty({ example: 'VIIRS' })
  instrument!: string;

  @ApiProperty({ example: '85' })
  confidence!: string;

  @ApiProperty({ example: '2.0NRT' })
  version!: string;

  @ApiProperty({ example: 12.341 })
  frp!: number;

  @ApiProperty({
    description: 'Dia o noche: D = day, N = night.',
    example: 'D',
  })
  daynight!: string;

  @ApiProperty({
    description: 'Fecha de creacion en base de datos (ISO 8601).',
    example: '2026-04-14T13:40:22.089Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Fecha de actualizacion en base de datos (ISO 8601).',
    example: '2026-04-14T13:40:22.089Z',
  })
  updatedAt!: string;
}

export class DetectionsPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1523 })
  total!: number;

  @ApiProperty({ example: 77 })
  totalPages!: number;
}

export class FindDetectionsResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Detections retrieved successfully' })
  message!: string;

  @ApiProperty({ type: [DetectionItemDto] })
  data!: DetectionItemDto[];

  @ApiProperty({ type: DetectionsPaginationMetaDto })
  meta!: DetectionsPaginationMetaDto;
}
