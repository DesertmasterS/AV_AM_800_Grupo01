import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permite que el frontend se comunique con esta API
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend corriendo en: http://localhost:${port}`);
}
bootstrap();