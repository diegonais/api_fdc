import { Injectable, LoggerService } from '@nestjs/common';
import pino, { type Bindings, type Logger as PinoLogger, type LoggerOptions } from 'pino';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: PinoLogger;

  constructor() {
    this.logger = pino(this.buildOptions());
  }

  child(bindings: Bindings): PinoLogger {
    return this.logger.child(bindings);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, this.extractContext(optionalParams));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, this.extractContext(optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, this.extractContext(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, this.extractContext(optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const trace =
      optionalParams.length > 0 && typeof optionalParams[0] === 'string'
        ? optionalParams[0]
        : undefined;
    const context =
      optionalParams.length > 1 && typeof optionalParams[1] === 'string'
        ? optionalParams[1]
        : this.extractContext(optionalParams);

    const metadata = trace ? { trace } : undefined;
    this.write('error', message, context, metadata);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, this.extractContext(optionalParams));
  }

  private buildOptions(): LoggerOptions {
    const baseOptions: LoggerOptions = {
      level: process.env.LOG_LEVEL ?? 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (process.env.NODE_ENV === 'production') {
      return baseOptions;
    }

    return {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:dd/mm/yyyy, h:MM:ss TT',
          ignore: 'pid,hostname',
          singleLine: true,
        },
      },
    };
  }

  private extractContext(optionalParams: unknown[]): string | undefined {
    const lastParam = optionalParams[optionalParams.length - 1];
    return typeof lastParam === 'string' ? lastParam : undefined;
  }

  private write(
    level: 'info' | 'warn' | 'debug' | 'trace' | 'error' | 'fatal',
    message: unknown,
    context?: string,
    extraMetadata?: Record<string, unknown>,
  ): void {
    const payload: Record<string, unknown> = {
      ...(extraMetadata ?? {}),
    };
    if (context) {
      payload.context = context;
    }

    if (message instanceof Error) {
      payload.err = message;
      const text = message.message || 'Application error';
      this.logWithPayload(level, payload, text);
      return;
    }

    if (typeof message === 'string') {
      this.logWithPayload(level, payload, message);
      return;
    }

    if (message && typeof message === 'object') {
      this.logWithPayload(level, { ...payload, ...(message as Record<string, unknown>) }, 'Log entry');
      return;
    }

    this.logWithPayload(level, payload, String(message));
  }

  private logWithPayload(
    level: 'info' | 'warn' | 'debug' | 'trace' | 'error' | 'fatal',
    payload: Record<string, unknown>,
    message: string,
  ): void {
    if (Object.keys(payload).length === 0) {
      this.logger[level](message);
      return;
    }

    this.logger[level](payload, message);
  }
}
