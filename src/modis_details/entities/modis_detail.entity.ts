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

@Entity({ name: 'modis_details' })
@Index('UQ_modis_details_detection_id', ['detection'], { unique: true })
export class ModisDetail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Detection, (detection) => detection.modisDetail, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'detection_id',
    foreignKeyConstraintName: 'FK_modis_details_detection_id',
  })
  detection!: Detection;

  @Column({ type: 'numeric', precision: 10, scale: 3 })
  brightness!: string;

  @Column({ name: 'bright_t31', type: 'numeric', precision: 10, scale: 3 })
  brightT31!: string;

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
