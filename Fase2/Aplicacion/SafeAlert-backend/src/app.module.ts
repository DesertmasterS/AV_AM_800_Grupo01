import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './database/entities/usuario.entity';
import { ContactoEmergencia } from './database/entities/contacto-emergencia.entity';
import { Cuartel } from './database/entities/cuartel.entity';
import { Alerta } from './database/entities/alerta.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Lectura del archivo .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Conexión con PostgreSQL en Neon.tech
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        ssl: {
          rejectUnauthorized: false, // Requerido por Neon.tech
        },
        entities: [Usuario, ContactoEmergencia, Cuartel, Alerta],
        synchronize: false,
      }),
    }),

    // Inyección de repositorios en el módulo
    TypeOrmModule.forFeature([Usuario, ContactoEmergencia, Cuartel, Alerta]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}