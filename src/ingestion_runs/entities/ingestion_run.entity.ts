import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'ingestion_runs' })
@Index('IDX_ingestion_runs_ingested_at', ['ingestedAt'])
export class IngestionRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  pipeline!: string;

  @Column({ type: 'text', array: true })
  sources!: string[];

  @Column({ name: 'day_range', type: 'integer' })
  dayRange!: number;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'fetched_count', type: 'integer' })
  fetchedCount!: number;

  @Column({ name: 'inserted_count', type: 'integer' })
  insertedCount!: number;

  @Column({ name: 'duplicate_count', type: 'integer' })
  duplicateCount!: number;

  @Column({
    name: 'ingested_at',
    type: 'timestamp',
    default: () => `timezone('America/La_Paz', now())`,
  })
  ingestedAt!: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
