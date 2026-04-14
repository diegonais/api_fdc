import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDetectionsAndSourceDetailsTables20260414133000
  implements MigrationInterface
{
  public readonly name = 'CreateDetectionsAndSourceDetailsTables20260414133000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TYPE "public"."detections_source_type_enum" AS ENUM ('VIIRS', 'MODIS')
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updated_at" = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.createTable(
      new Table({
        name: 'detections',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'source_type',
            type: 'enum',
            enumName: 'detections_source_type_enum',
            enum: ['VIIRS', 'MODIS'],
            isNullable: false,
          },
          {
            name: 'latitude',
            type: 'numeric',
            precision: 10,
            scale: 6,
            isNullable: false,
          },
          {
            name: 'longitude',
            type: 'numeric',
            precision: 10,
            scale: 6,
            isNullable: false,
          },
          {
            name: 'scan',
            type: 'numeric',
            precision: 8,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'track',
            type: 'numeric',
            precision: 8,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'acq_date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'acq_time',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'satellite',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'instrument',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'confidence',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'frp',
            type: 'numeric',
            precision: 10,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'daynight',
            type: 'char',
            length: '1',
            isNullable: false,
          },
          {
            name: 'dedupe_key',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'raw_record',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'detections',
      new TableIndex({
        name: 'IDX_detections_acq_date',
        columnNames: ['acq_date'],
      }),
    );
    await queryRunner.createIndex(
      'detections',
      new TableIndex({
        name: 'IDX_detections_latitude_longitude',
        columnNames: ['latitude', 'longitude'],
      }),
    );
    await queryRunner.createIndex(
      'detections',
      new TableIndex({
        name: 'IDX_detections_satellite',
        columnNames: ['satellite'],
      }),
    );
    await queryRunner.createIndex(
      'detections',
      new TableIndex({
        name: 'IDX_detections_source_type',
        columnNames: ['source_type'],
      }),
    );
    await queryRunner.createIndex(
      'detections',
      new TableIndex({
        name: 'UQ_detections_dedupe_key',
        columnNames: ['dedupe_key'],
        isUnique: true,
      }),
    );

    await queryRunner.query(`
      CREATE TRIGGER "TRG_detections_set_updated_at"
      BEFORE UPDATE ON "detections"
      FOR EACH ROW
      EXECUTE FUNCTION "public"."set_updated_at"()
    `);

    await queryRunner.createTable(
      new Table({
        name: 'viirs_details',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'detection_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'bright_ti4',
            type: 'numeric',
            precision: 10,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'bright_ti5',
            type: 'numeric',
            precision: 10,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'viirs_details',
      new TableForeignKey({
        name: 'FK_viirs_details_detection_id',
        columnNames: ['detection_id'],
        referencedTableName: 'detections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'viirs_details',
      new TableIndex({
        name: 'UQ_viirs_details_detection_id',
        columnNames: ['detection_id'],
        isUnique: true,
      }),
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_viirs_details_set_updated_at"
      BEFORE UPDATE ON "viirs_details"
      FOR EACH ROW
      EXECUTE FUNCTION "public"."set_updated_at"()
    `);

    await queryRunner.createTable(
      new Table({
        name: 'modis_details',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'detection_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'brightness',
            type: 'numeric',
            precision: 10,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'bright_t31',
            type: 'numeric',
            precision: 10,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'modis_details',
      new TableForeignKey({
        name: 'FK_modis_details_detection_id',
        columnNames: ['detection_id'],
        referencedTableName: 'detections',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'modis_details',
      new TableIndex({
        name: 'UQ_modis_details_detection_id',
        columnNames: ['detection_id'],
        isUnique: true,
      }),
    );
    await queryRunner.query(`
      CREATE TRIGGER "TRG_modis_details_set_updated_at"
      BEFORE UPDATE ON "modis_details"
      FOR EACH ROW
      EXECUTE FUNCTION "public"."set_updated_at"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_modis_details_set_updated_at" ON "modis_details"
    `);
    await queryRunner.dropIndex('modis_details', 'UQ_modis_details_detection_id');
    await queryRunner.dropForeignKey('modis_details', 'FK_modis_details_detection_id');
    await queryRunner.dropTable('modis_details');

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_viirs_details_set_updated_at" ON "viirs_details"
    `);
    await queryRunner.dropIndex('viirs_details', 'UQ_viirs_details_detection_id');
    await queryRunner.dropForeignKey('viirs_details', 'FK_viirs_details_detection_id');
    await queryRunner.dropTable('viirs_details');

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "TRG_detections_set_updated_at" ON "detections"
    `);
    await queryRunner.dropIndex('detections', 'UQ_detections_dedupe_key');
    await queryRunner.dropIndex('detections', 'IDX_detections_source_type');
    await queryRunner.dropIndex('detections', 'IDX_detections_satellite');
    await queryRunner.dropIndex('detections', 'IDX_detections_latitude_longitude');
    await queryRunner.dropIndex('detections', 'IDX_detections_acq_date');
    await queryRunner.dropTable('detections');

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS "public"."set_updated_at"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."detections_source_type_enum"
    `);
  }
}
