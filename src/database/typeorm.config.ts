import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { parseBoolean } from '../config/parse-env.util';

export const getTypeOrmConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const dbSsl = parseBoolean(configService.get('DB_SSL'));
  const dbTimezone = String(configService.get<string>('TZ') || 'America/La_Paz').trim();

  const common: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize: parseBoolean(configService.get('DB_SYNCHRONIZE')),
    logging: parseBoolean(configService.get('DB_LOGGING')),
    migrations: ['dist/database/migrations/*{.js,.ts}'],
    ssl: dbSsl ? { rejectUnauthorized: false } : false,
    extra: {
      options: `-c TimeZone=${dbTimezone}`,
    },
  };

  if (databaseUrl) {
    return {
      ...common,
      url: databaseUrl,
    };
  }

  return {
    ...common,
    host: configService.get<string>('DB_HOST'),
    port: Number(configService.get<number>('DB_PORT')),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
  };
};
