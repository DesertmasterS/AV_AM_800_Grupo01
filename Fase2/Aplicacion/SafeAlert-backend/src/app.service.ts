import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from './database/entities/alerta.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Alerta)
    private alertaRepo: Repository<Alerta>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }
  //Prueba de conexión con DB-Neon
  async registrarAlerta(): Promise<Alerta> {
    const nuevaAlerta = this.alertaRepo.create({
      tipo: 'EMERGENCIA_SOS',
    });
    return await this.alertaRepo.save(nuevaAlerta);
  }
}