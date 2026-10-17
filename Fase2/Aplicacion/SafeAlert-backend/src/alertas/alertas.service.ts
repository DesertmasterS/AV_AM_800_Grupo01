import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { CrearAlertaDto, OrigenAlerta } from './dto/crear-alerta.dto';

@Injectable()
export class AlertasService {
  constructor(
    @InjectRepository(Alerta) private readonly alertaRepo: Repository<Alerta>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async crearAlerta(dto: CrearAlertaDto, usuarioId?: number) {
    this.validarUsuarioId(usuarioId);
    const usuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException('La cuenta de la sesión no está disponible');

    const tieneLatitud = dto.latitud != null;
    const tieneLongitud = dto.longitud != null;
    if (tieneLatitud !== tieneLongitud) {
      throw new BadRequestException('Envía ambas coordenadas o ninguna');
    }

    const origen = dto.origen ?? OrigenAlerta.BOTON;
    const eventoId = dto.eventoId ?? null;
    if (eventoId) {
      const existente = await this.buscarEvento(eventoId, usuarioId);
      if (existente) return this.respuesta(existente, usuarioId, true);
    }
    const nuevaAlerta = this.alertaRepo.create({
      tipo: 'EMERGENCIA_' + (origen === OrigenAlerta.BOTON ? 'SOS' : origen),
      eventoId,
      // Si no hay GPS, conservar ausencia de ubicación. No inventar coordenadas.
      latitud: tieneLatitud ? dto.latitud! : null,
      longitud: tieneLongitud ? dto.longitud! : null,
      estado: 'ACTIVA',
      mensajePoliciaEstado: 'NO_APLICA',
      cuartel: null,
      usuario,
    });
    try {
      const guardada = await this.alertaRepo.save(nuevaAlerta);
      return this.respuesta(guardada, usuarioId, false);
    } catch (error: unknown) {
      // La restricción única también cubre solicitudes concurrentes y varias instancias.
      const code = (error as { driverError?: { code?: string } })?.driverError?.code;
      if (eventoId && code === '23505') {
        const existente = await this.buscarEvento(eventoId, usuarioId);
        if (existente) return this.respuesta(existente, usuarioId, true);
      }
      throw error;
    }
  }

  async obtenerHistorial(usuarioId: number) {
    this.validarUsuarioId(usuarioId);
    return this.alertaRepo.find({
      where: { usuario: { id: usuarioId } },
      order: { fecha: 'DESC' },
      take: 20,
    });
  }

  private buscarEvento(eventoId: string, usuarioId: number) {
    return this.alertaRepo.findOne({ where: { eventoId, usuario: { id: usuarioId } } });
  }

  private validarUsuarioId(id: number | undefined): asserts id is number {
    if (!Number.isSafeInteger(id) || (id ?? 0) <= 0) {
      throw new UnauthorizedException('La sesión no contiene un usuario válido');
    }
  }

  private respuesta(alerta: Alerta, usuarioId: number, duplicada: boolean) {
    return {
      mensaje: duplicada ? 'Este evento ya estaba registrado' : 'Alerta de emergencia registrada exitosamente',
      id: alerta.id, alertaId: alerta.id, usuarioId,
      origen: alerta.tipo === 'EMERGENCIA_MOVIMIENTO' ? OrigenAlerta.MOVIMIENTO
        : alerta.tipo === 'EMERGENCIA_VOLUMEN' ? OrigenAlerta.VOLUMEN : OrigenAlerta.BOTON,
      eventoId: alerta.eventoId, duplicada,
      latitud: alerta.latitud, longitud: alerta.longitud, fecha: alerta.fecha,
    };
  }
}
