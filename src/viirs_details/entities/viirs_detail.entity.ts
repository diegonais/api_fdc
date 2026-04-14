import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Detection } from '../../detections/entities/detection.entity';

@Entity({ name: 'viirs_details' })
@Index('UQ_viirs_details_detection_id', ['detection'], { unique: true })
export class ViirsDetail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Detection, (detection) => detection.viirsDetail, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'detection_id',
    foreignKeyConstraintName: 'FK_viirs_details_detection_id',
  })
  detection!: Detection;

  @Column({ name: 'bright_ti4', type: 'numeric', precision: 10, scale: 3 })
  brightTi4!: string;

  @Column({ name: 'bright_ti5', type: 'numeric', precision: 10, scale: 3 })
  brightTi5!: string;

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
}
