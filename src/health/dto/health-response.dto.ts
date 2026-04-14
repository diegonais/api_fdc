import { ApiProperty } from '@nestjs/swagger';

export class HealthServicesDto {
  @ApiProperty({
    description: 'Estado de la base de datos.',
    enum: ['up', 'down'],
    example: 'up',
  })
  database!: 'up' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({
    description: 'Estado general del servicio.',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status!: 'ok' | 'error';

  @ApiProperty({ type: HealthServicesDto })
  services!: HealthServicesDto;

  @ApiProperty({
    description: 'Timestamp del chequeo en formato ISO 8601.',
    example: '2026-04-14T20:06:04.553Z',
  })
  timestamp!: string;
}
