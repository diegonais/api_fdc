import { ConfigService } from '@nestjs/config';
import { FirmsClient } from './firms.client';
import { FirmsSource } from './firms.constants';

describe('FirmsClient', () => {
  let client: FirmsClient;

  beforeEach(() => {
    const values: Record<string, unknown> = {
      FIRMS_MAP_KEY: 'test-key',
      FIRMS_BASE_URL: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
      FIRMS_BBOX: '-69.8,-22.9,-57.4,-9.6',
      FIRMS_ENABLED_SOURCES: 'VIIRS_SNPP_NRT,MODIS_NRT',
      FIRMS_INITIAL_SYNC_START_DATE: '2026-01-01',
      FIRMS_LOOKBACK_DAYS: 4,
      FIRMS_SYNC_EVERY_MINUTES: 5,
      FIRMS_RUN_ON_BOOT: true,
      FIRMS_REQUEST_TIMEOUT_MS: 15000,
    };
    const configService = {
      get: (key: string) => values[key],
    } as ConfigService;

    client = new FirmsClient(configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch and parse CSV data', async () => {
    const csv =
      'latitude,longitude,confidence,comment\r\n' +
      '-17.123456,-63.123456,h,"value with, comma"\r\n';

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => csv,
    } as Response);

    const rows = await client.fetchDetections(FirmsSource.VIIRS_SNPP_NRT, 2);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      latitude: '-17.123456',
      longitude: '-63.123456',
      confidence: 'h',
      comment: 'value with, comma',
    });
  });

  it('should throw when FIRMS returns a non-200 response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as Response);

    await expect(
      client.fetchDetections(FirmsSource.MODIS_NRT, 1),
    ).rejects.toThrow('FIRMS request failed for MODIS_NRT with status 500');
  });
});
