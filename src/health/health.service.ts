import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        services: {
          database: 'up',
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        services: {
          database: 'down',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
