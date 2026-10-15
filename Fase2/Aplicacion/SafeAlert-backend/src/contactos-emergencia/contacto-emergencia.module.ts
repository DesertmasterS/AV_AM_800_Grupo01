import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactosEmergenciaController } from './contacto-emergencia.controller';
import { ContactosEmergenciaService } from './contacto-emergencia.service';
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity';
import { AuthModule } from '../auth/auth.module'; //

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactoEmergencia]),
    AuthModule, // 2. Agrega AuthModule a los imports
  ],
  controllers: [ContactosEmergenciaController],
  providers: [ContactosEmergenciaService], // 3. Quita AuthGuard de aquí (no debe listarse en providers)
  exports: [ContactosEmergenciaService],
})
export class ContactosEmergenciaModule {}