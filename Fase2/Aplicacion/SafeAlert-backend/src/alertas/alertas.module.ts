import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { AuthModule } from '../auth/auth.module'; 
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alerta, Usuario, ContactoEmergencia]),
    AuthModule, //
  ],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}