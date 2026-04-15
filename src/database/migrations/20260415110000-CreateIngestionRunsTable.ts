import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableIndex,
} from 'typeorm';

export class CreateIngestionRunsTable20260415110000
  implements MigrationInterface
{
  public readonly name = 'CreateIngestionRunsTable20260415110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ingestion_runs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'pipeline',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'sources',
            type: 'text',
            isArray: true,
            isNullable: false,
          },
          {
            name: 'day_range',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'start_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'fetched_count',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'inserted_count',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'duplicate_count',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'ingested_at',
            type: 'timestamp without time zone',
            default: `timezone('America/La_Paz', now())`,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createCheckConstraint(
      'ingestion_runs',
      new TableCheck({
        name: 'CHK_ingestion_runs_inserted_count_positive',
        expression: '"inserted_count" > 0',
      }),
    );
    await queryRunner.createCheckConstraint(
      'ingestion_runs',
      new TableCheck({
        name: 'CHK_ingestion_runs_counts_consistent',
        expression:
          '"fetched_count" >= "inserted_count" AND "duplicate_count" >= 0 AND "day_range" > 0',
      }),
    );
    await queryRunner.createCheckConstraint(
      'ingestion_runs',
      new TableCheck({
        name: 'CHK_ingestion_runs_sources_not_empty',
        expression: 'array_length("sources", 1) > 0',
      }),
    );

    await queryRunner.createIndex(
      'ingestion_runs',
      new TableIndex({
        name: 'IDX_ingestion_runs_ingested_at',
        columnNames: ['ingested_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('ingestion_runs', 'IDX_ingestion_runs_ingested_at');
    await queryRunner.dropCheckConstraint(
      'ingestion_runs',
      'CHK_ingestion_runs_sources_not_empty',
    );
    await queryRunner.dropCheckConstraint(
      'ingestion_runs',
      'CHK_ingestion_runs_counts_consistent',
    );
    await queryRunner.dropCheckConstraint(
      'ingestion_runs',
      'CHK_ingestion_runs_inserted_count_positive',
    );
    await queryRunner.dropTable('ingestion_runs');
  }
}
