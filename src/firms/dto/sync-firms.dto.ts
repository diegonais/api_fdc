import { Type } from 'class-transformer';
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
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(FirmsSource, { each: true })
  sources?: FirmsSource[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FIRMS_MAX_DAY_RANGE)
  dayRange?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;
}
