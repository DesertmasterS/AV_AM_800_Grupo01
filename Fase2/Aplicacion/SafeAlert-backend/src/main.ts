import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { configureHttpSecurity } from './security/http/http-security';
import { AppModule } from './app.module';

// Fijar zona horaria de Chile
process.env.TZ = 'America/Santiago';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttpSecurity(app);

  // 1. Parser de cookies para la sesión JWT
  app.use(cookieParser());

  // 2. Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. CORS conectado a FRONTEND_URL y conexiones propias
  const origenesPermitidos = [
    'http://localhost:8100',
    'http://localhost:4200',
    'http://127.0.0.1:8100',
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
    process.env.FRONTEND_URL?.replace(/\/$/, ''),
  ].filter((item): item is string => Boolean(item));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || origenesPermitidos.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');
  console.log(`Servidor SafeAlert corriendo en ${port}`);
}
bootstrap();