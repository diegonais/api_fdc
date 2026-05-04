import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLogger } from './logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const appLogger = app.get(AppLogger);
  app.useLogger(appLogger);
  app.flushLogs();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api_fdc/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API FDC')
    .setDescription(
      [
        'API para ingesta y consulta de focos de calor de NASA FIRMS.',
        '',
        'Flujo recomendado de arranque:',
        '1. Ejecutar migraciones.',
        '2. Iniciar la API.',
        '3. Si no hay datos en `detections`, se realiza carga inicial desde `FIRMS_INITIAL_SYNC_START_DATE`.',
        '4. Al finalizar la carga inicial, se habilita el cron incremental.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addTag('Health', 'Estado de salud y conectividad de la API.')
    .addTag('Detections', 'Consulta paginada de detecciones almacenadas.')
    .addTag('FIRMS Sync', 'Sincronizacion manual de datos desde NASA FIRMS.')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api_fdc/v1/docs', app, swaggerDocument);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap().catch((error) => {
  // Fallback log in case the app fails before AppLogger is fully wired.
  console.error('Application failed to bootstrap:', error);
  process.exit(1);
});
