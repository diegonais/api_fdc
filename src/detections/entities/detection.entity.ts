import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModisDetail } from '../../modis_details/entities/modis_detail.entity';
import { ViirsDetail } from '../../viirs_details/entities/viirs_detail.entity';

export enum DetectionSourceType {
  VIIRS = 'VIIRS',
  MODIS = 'MODIS',
}

@Entity({ name: 'detections' })
@Index('IDX_detections_acq_date', ['acqDate'])
@Index('IDX_detections_latitude_longitude', ['latitude', 'longitude'])
@Index('IDX_detections_satellite', ['satellite'])
@Index('IDX_detections_source_type', ['sourceType'])
@Index('UQ_detections_dedupe_key', ['dedupeKey'], { unique: true })
export class Detection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: DetectionSourceType,
    enumName: 'detections_source_type_enum',
  })
  sourceType!: DetectionSourceType;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  latitude!: string;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  longitude!: string;

  @Column({ type: 'numeric', precision: 8, scale: 3 })
  scan!: string;

  @Column({ type: 'numeric', precision: 8, scale: 3 })
  track!: string;

  @Column({ name: 'acq_date', type: 'date' })
  acqDate!: string;

  @Column({ name: 'acq_time', type: 'integer' })
  acqTime!: number;

  @Column({ type: 'varchar', length: 20 })
  satellite!: string;

  @Column({ type: 'varchar', length: 20 })
  instrument!: string;

  @Column({ type: 'varchar', length: 20 })
  confidence!: string;

  @Column({ type: 'varchar', length: 20 })
  version!: string;

  @Column({ type: 'numeric', precision: 10, scale: 3 })
  frp!: string;

  @Column({ type: 'char', length: 1 })
  daynight!: string;

  @Column({
    name: 'dedupe_key',
    type: 'varchar',
    length: 64,
    select: false,
  })
  dedupeKey!: string;

  @Column({
    name: 'raw_record',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  rawRecord!: Record<string, string>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @OneToOne(() => ViirsDetail, (viirsDetail) => viirsDetail.detection)
  viirsDetail?: ViirsDetail | null;

  @OneToOne(() => ModisDetail, (modisDetail) => modisDetail.detection)
  modisDetail?: ModisDetail | null;
}
