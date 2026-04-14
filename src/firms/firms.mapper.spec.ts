import { FirmsMapper } from './firms.mapper';
import { FirmsSource } from './firms.constants';

describe('FirmsMapper', () => {
  let mapper: FirmsMapper;

  beforeEach(() => {
    mapper = new FirmsMapper();
  });

  it('should keep acq_date and acq_time exactly as received from FIRMS', () => {
    const rows = [
      {
        latitude: '-17.123456',
        longitude: '-63.123456',
        scan: '0.4',
        track: '0.4',
        acq_date: '2026-04-14',
        acq_time: '0030',
        satellite: 'NPP',
        instrument: 'VIIRS',
        confidence: 'h',
        version: '2.0NRT',
        frp: '2.1',
        daynight: 'N',
        bright_ti4: '330.1',
        bright_ti5: '290.5',
      },
    ];

    const result = mapper.mapRows(FirmsSource.VIIRS_SNPP_NRT, rows);

    expect(result).toHaveLength(1);
    expect(result[0].detection.acqDate).toBe('2026-04-14');
    expect(result[0].detection.acqTime).toBe(30);
  });
});
