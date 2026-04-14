export enum FirmsSource {
  VIIRS_SNPP_NRT = 'VIIRS_SNPP_NRT',
  VIIRS_NOAA20_NRT = 'VIIRS_NOAA20_NRT',
  VIIRS_NOAA21_NRT = 'VIIRS_NOAA21_NRT',
  MODIS_NRT = 'MODIS_NRT',
}

export const DEFAULT_FIRMS_SOURCES: FirmsSource[] = [
  FirmsSource.VIIRS_SNPP_NRT,
  FirmsSource.VIIRS_NOAA20_NRT,
  FirmsSource.VIIRS_NOAA21_NRT,
  FirmsSource.MODIS_NRT,
];

export const FIRMS_MAX_DAY_RANGE = 5;
