import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
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
    }),
  );

  app.setGlobalPrefix('api_fdc/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API FDC')
    .setDescription('API de focos de calor (NASA FIRMS)')
    .setVersion('1.0')
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
