import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { parseBoolean } from '../config/parse-env.util';
import { Detection } from '../detections/entities/detection.entity';
import { ModisDetail } from '../modis_details/entities/modis_detail.entity';
import { ViirsDetail } from '../viirs_details/entities/viirs_detail.entity';
import { CreateDetectionsAndSourceDetailsTables20260414133000 } from './migrations/20260414133000-CreateDetectionsAndSourceDetailsTables';

const databaseUrl = process.env.DATABASE_URL;
const dbSsl = parseBoolean(process.env.DB_SSL);
const dbTimezone = String(process.env.TZ || 'America/La_Paz').trim() || 'America/La_Paz';

const dataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl || undefined,
  host: databaseUrl ? undefined : process.env.DB_HOST,
  port: databaseUrl ? undefined : Number(process.env.DB_PORT ?? 5432),
  username: databaseUrl ? undefined : process.env.DB_USERNAME,
  password: databaseUrl ? undefined : process.env.DB_PASSWORD,
  database: databaseUrl ? undefined : process.env.DB_NAME,
  entities: [Detection, ViirsDetail, ModisDetail],
  migrations: [CreateDetectionsAndSourceDetailsTables20260414133000],
  ssl: dbSsl ? { rejectUnauthorized: false } : false,
  extra: {
    options: `-c TimeZone=${dbTimezone}`,
  },
});

export default dataSource;
