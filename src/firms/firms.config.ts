import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_FIRMS_SOURCES,
  FIRMS_MAX_DAY_RANGE,
  FirmsSource,
} from './firms.constants';
import { parseBoolean } from '../config/parse-env.util';

export type FirmsSettings = {
  mapKey: string;
  baseUrl: string;
  bbox: string;
  enabledSources: FirmsSource[];
  initialSyncStartDate: string;
  lookbackDays: number;
  syncEveryMinutes: number;
  runOnBoot: boolean;
  requestTimeoutMs: number;
};

function parseEnabledSources(rawSources?: string): FirmsSource[] {
  const parsed = (rawSources ?? DEFAULT_FIRMS_SOURCES.join(','))
    .split(',')
    .map((source) => source.trim().toUpperCase())
    .filter((source) => source.length > 0);

  if (parsed.length === 0) {
    throw new Error('FIRMS_ENABLED_SOURCES must include at least one source.');
  }

  const invalidSources = parsed.filter(
    (source) => !Object.values(FirmsSource).includes(source as FirmsSource),
  );

  if (invalidSources.length > 0) {
    throw new Error(
      `FIRMS_ENABLED_SOURCES has invalid values: ${invalidSources.join(', ')}`,
    );
  }

  return parsed as FirmsSource[];
}

export function getFirmsSettings(configService: ConfigService): FirmsSettings {
  const mapKey = String(configService.get('FIRMS_MAP_KEY') ?? '').trim();
  const baseUrl = String(configService.get('FIRMS_BASE_URL') ?? '').trim();
  const bbox = String(configService.get('FIRMS_BBOX') ?? '').trim();
  const initialSyncStartDate = String(
    configService.get('FIRMS_INITIAL_SYNC_START_DATE') ?? '',
  ).trim();
  const lookbackDays = Number(configService.get('FIRMS_LOOKBACK_DAYS'));
  const syncEveryMinutes = Number(configService.get('FIRMS_SYNC_EVERY_MINUTES'));
  const requestTimeoutMs = Number(configService.get('FIRMS_REQUEST_TIMEOUT_MS'));

  if (!mapKey) throw new Error('FIRMS_MAP_KEY is required.');
  if (!baseUrl) throw new Error('FIRMS_BASE_URL is required.');
  if (!bbox) throw new Error('FIRMS_BBOX is required.');
  if (!initialSyncStartDate) {
    throw new Error('FIRMS_INITIAL_SYNC_START_DATE is required.');
  }
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0) {
    throw new Error('FIRMS_LOOKBACK_DAYS must be an integer >= 0.');
  }
  if (!Number.isInteger(syncEveryMinutes) || syncEveryMinutes < 1) {
    throw new Error('FIRMS_SYNC_EVERY_MINUTES must be an integer >= 1.');
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1000) {
    throw new Error('FIRMS_REQUEST_TIMEOUT_MS must be an integer >= 1000.');
  }

  if (lookbackDays > FIRMS_MAX_DAY_RANGE) {
    throw new Error(
      `FIRMS_LOOKBACK_DAYS cannot be greater than ${FIRMS_MAX_DAY_RANGE}.`,
    );
  }

  return {
    mapKey,
    baseUrl,
    bbox,
    enabledSources: parseEnabledSources(
      String(configService.get('FIRMS_ENABLED_SOURCES') ?? ''),
    ),
    initialSyncStartDate,
    lookbackDays,
    syncEveryMinutes,
    runOnBoot: parseBoolean(configService.get('FIRMS_RUN_ON_BOOT')),
    requestTimeoutMs,
  };
}
