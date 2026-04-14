import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getFirmsSettings } from './firms.config';
import { FIRMS_MAX_DAY_RANGE, FirmsSource } from './firms.constants';
import { FirmsCsvRecord } from './firms.types';

@Injectable()
export class FirmsClient {
  constructor(private readonly configService: ConfigService) {}

  async fetchDetections(
    source: FirmsSource,
    dayRange: number,
    startDate?: string,
  ): Promise<FirmsCsvRecord[]> {
    if (!Number.isInteger(dayRange) || dayRange < 1) {
      throw new Error('dayRange must be an integer >= 1.');
    }

    if (dayRange > FIRMS_MAX_DAY_RANGE) {
      throw new Error(`dayRange cannot be greater than ${FIRMS_MAX_DAY_RANGE}.`);
    }

    const settings = getFirmsSettings(this.configService);
    const url = this.buildSourceUrl(
      settings.baseUrl,
      settings.mapKey,
      source,
      settings.bbox,
      dayRange,
      startDate,
    );
    const response = await fetch(url, {
      headers: { Accept: 'text/csv' },
      signal: AbortSignal.timeout(settings.requestTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `FIRMS request failed for ${source} with status ${response.status}`,
      );
    }

    const responseText = await response.text();

    return this.parseCsv(responseText);
  }

  private buildSourceUrl(
    baseUrl: string,
    mapKey: string,
    source: FirmsSource,
    bbox: string,
    dayRange: number,
    startDate?: string,
  ): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const basePath = `${normalizedBaseUrl}/${encodeURIComponent(mapKey)}/${encodeURIComponent(source)}/${bbox}/${dayRange}`;

    if (!startDate) return basePath;

    return `${basePath}/${startDate}`;
  }

  private parseCsv(csv: string): FirmsCsvRecord[] {
    const normalizedCsv = csv.replace(/^\uFEFF/, '').trim();

    if (!normalizedCsv) return [];

    const lines = normalizedCsv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) return [];

    const headers = this.splitCsvLine(lines[0]).map((header) =>
      header.trim().toLowerCase(),
    );

    return lines.slice(1).map((line) => {
      const values = this.splitCsvLine(line);

      return headers.reduce<FirmsCsvRecord>((row, header, index) => {
        row[header] = (values[index] ?? '').trim();
        return row;
      }, {});
    });
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let isInsideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const nextCharacter = line[index + 1];

      if (character === '"') {
        if (isInsideQuotes && nextCharacter === '"') {
          currentValue += '"';
          index += 1;
          continue;
        }

        isInsideQuotes = !isInsideQuotes;
        continue;
      }

      if (character === ',' && !isInsideQuotes) {
        values.push(currentValue);
        currentValue = '';
        continue;
      }

      currentValue += character;
    }

    values.push(currentValue);

    return values;
  }
}
