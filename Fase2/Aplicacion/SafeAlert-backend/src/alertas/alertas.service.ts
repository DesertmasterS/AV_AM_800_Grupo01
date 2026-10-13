import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { CrearAlertaDto } from './dto/crear-alerta.dto';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertaRepo: Repository<Alerta>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async crearAlerta(dto: CrearAlertaDto, usuarioId?: number) {
  const lat = dto.latitud ?? -33.4372;
  const lon = dto.longitud ?? -70.6506;

  const nuevaAlerta = this.alertaRepo.create({
    tipo: 'EMERGENCIA_SOS',
    latitud: lat,
    longitud: lon,
    estado: 'ACTIVA',
    mensajePoliciaEstado: 'NO_APLICA',
    cuartel: null,
    usuario: usuarioId ? ({ id: usuarioId } as Usuario) : null,
  });

  const guardada = await this.alertaRepo.save(nuevaAlerta);

  return {
    mensaje: 'Alerta de emergencia registrada exitosamente',
    id: guardada.id,
    alertaId: guardada.id,
    usuarioId: usuarioId ?? null,
    latitud: guardada.latitud,
    longitud: guardada.longitud,
    fecha: guardada.fecha,
  };
}

  async obtenerHistorial() {
    return await this.alertaRepo.find({
      relations: {
        usuario: true, 
      },
      order: { fecha: 'DESC' },
      take: 20,
    });
  }
}