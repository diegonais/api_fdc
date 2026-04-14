import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3001),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  TZ: Joi.string().default('America/La_Paz'),

  FIRMS_MAP_KEY: Joi.string().allow('').default(''),
  FIRMS_BASE_URL: Joi.string().uri().required(),
  FIRMS_BBOX: Joi.string().required(),
  FIRMS_ENABLED_SOURCES: Joi.string().required(),
  FIRMS_INITIAL_SYNC_START_DATE: Joi.string().isoDate().required(),
  FIRMS_LOOKBACK_DAYS: Joi.number().integer().min(0).default(4),
  FIRMS_SYNC_EVERY_MINUTES: Joi.number().integer().min(1).max(59).default(5),
  FIRMS_RUN_ON_BOOT: Joi.boolean().default(true),
  FIRMS_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),

  DATABASE_URL: Joi.string().allow('').default(''),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
});
