import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DetectionIdParamDto {
  @ApiProperty({
    description: 'Identificador UUID de la deteccion.',
    example: '2c232036-679d-4bb1-8a59-3b30b6114a2a',
  })
  @IsUUID('4')
  id!: string;
}
