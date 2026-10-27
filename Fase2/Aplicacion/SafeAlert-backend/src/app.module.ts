import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entidades
import { Usuario } from './database/entities/usuario.entity';
import { ContactoEmergencia } from './database/entities/contacto-emergencia.entity';
import { Cuartel } from './database/entities/cuartel.entity';
import { Alerta } from './database/entities/alerta.entity';

// Módulos funcionales
import { AuthModule } from './auth/auth.module';
import { AlertasModule } from './alertas/alertas.module'; 
import { ContactosEmergenciaModule } from './contactos-emergencia/contacto-emergencia.module';

// Controlador y Servicio principales
import { AppController } from './app.controller';
import { AppService } from './app.service';



@Module({
  imports: [
    // 1. Lectura del archivo .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Conexión global con PostgreSQL en Neon.tech
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
        extra: {
          ssl: { rejectUnauthorized: false },
          options: '-c timezone=America/Santiago',
        },
        entities: [Usuario, ContactoEmergencia, Cuartel, Alerta],
        synchronize: false,
      }),
    }),

    // 3. Módulos de la aplicación
    AuthModule,
    AlertasModule,
    ContactosEmergenciaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}