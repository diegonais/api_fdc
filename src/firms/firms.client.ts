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
    let response: Response;

    try {
      response = await fetch(url, {
        headers: { Accept: 'text/csv' },
        signal: AbortSignal.timeout(settings.requestTimeoutMs),
      });
    } catch (error) {
      throw new Error(
        `FIRMS request failed for ${source}: ${this.formatTransportError(error)}`,
      );
    }

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      const errorDetail = await this.readErrorDetail(response, settings.mapKey);
      const detailMessage = errorDetail ? `. Detail: ${errorDetail}` : '';

      throw new Error(
        `FIRMS request failed for ${source} with status ${response.status}${statusText}${detailMessage}`,
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

  private async readErrorDetail(
    response: Response,
    mapKey: string,
  ): Promise<string | null> {
    let responseText: string;

    try {
      responseText = await response.text();
    } catch {
      return null;
    }

    const normalizedDetail = this.redactMapKey(responseText, mapKey)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    return normalizedDetail || null;
  }

  private redactMapKey(value: string, mapKey: string): string {
    if (!mapKey) return value;

    return value.split(mapKey).join('[REDACTED_MAP_KEY]');
  }

  private formatTransportError(error: unknown): string {
    if (error instanceof Error) {
      const details = error.message
        ? `${error.name}: ${error.message}`
        : error.name;

      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return `request timeout (${details})`;
      }

      return details;
    }

    return 'Unknown network error';
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
