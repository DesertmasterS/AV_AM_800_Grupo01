import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactosEmergenciaController } from './contacto-emergencia.controller';
import { ContactosEmergenciaService } from './contacto-emergencia.service';
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactoEmergencia, Usuario]),
    AuthModule,
  ],
  controllers: [ContactosEmergenciaController],
  providers: [ContactosEmergenciaService],
  exports: [ContactosEmergenciaService],
})
export class ContactosEmergenciaModule {}