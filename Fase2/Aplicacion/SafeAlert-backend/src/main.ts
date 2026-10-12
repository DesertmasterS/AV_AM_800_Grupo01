import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Parser de cookies
  app.use(cookieParser());

  // 2. Tubería de validación global (aplica los decoradores del DTO y rechaza campos extra)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. CORS estricto con credenciales para intercambio de cookies
  app.enableCors({
    origin: [
      'http://localhost:8100', // Ionic Serve predeterminado
      'http://localhost:4200', // Angular CLI
      'http://127.0.0.1:8100',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Servidor SafeAlert corriendo en http://localhost:${port}`);
}
bootstrap();