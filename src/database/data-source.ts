import 'dotenv/config';
import { DataSource } from 'typeorm';
import { parseBoolean } from '../config/parse-env.util';

const databaseUrl = process.env.DATABASE_URL;
const dbSsl = parseBoolean(process.env.DB_SSL);

const dataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl || undefined,
  host: databaseUrl ? undefined : process.env.DB_HOST,
  port: databaseUrl ? undefined : Number(process.env.DB_PORT ?? 5432),
  username: databaseUrl ? undefined : process.env.DB_USERNAME,
  password: databaseUrl ? undefined : process.env.DB_PASSWORD,
  database: databaseUrl ? undefined : process.env.DB_NAME,
  entities: ['src/**/*.entity{.ts,.js}', 'dist/**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*{.ts,.js}', 'dist/database/migrations/*{.ts,.js}'],
  ssl: dbSsl ? { rejectUnauthorized: false } : false,
});

export default dataSource;
