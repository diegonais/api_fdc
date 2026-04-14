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
import { DetectionSourceType } from '../entities/detection.entity';

export class FindDetectionsQueryDto {
  @IsOptional()
  @IsEnum(DetectionSourceType)
  source?: DetectionSourceType;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  date_from?: string;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  date_to?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Max(100)
  min_confidence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/\S/u)
  satellite?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
