import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from './database/entities/alerta.entity';
import { Cuartel } from './database/entities/cuartel.entity';
import { Usuario } from './database/entities/usuario.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Alerta)
    private readonly alertaRepo: Repository<Alerta>,
    @InjectRepository(Cuartel)
    private readonly cuartelRepo: Repository<Cuartel>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  getHello(): string {
    return 'SafeAlert API Online';
  }

  async crearAlerta(lat: number, lon: number, notificarPolicia: boolean) {
    let cuartelCercano: any = null;
    let estadoPolicia = 'NO_SOLICITADO';

    // 1. Solo busca cuartel si el usuario activó la opción
    if (notificarPolicia) {
      const resultado: any[] = await this.cuartelRepo.query(
        `
        SELECT id, nombre, telefono, email,
          (6371 * acos(
            cos(radians($1)) * cos(radians(latitud)) *
            cos(radians(longitud) - radians($2)) +
            sin(radians($1)) * sin(radians(latitud))
          )) AS distancia_km
        FROM cuarteles
        ORDER BY distancia_km ASC
        LIMIT 1;
        `,
        [lat, lon],
      );

      cuartelCercano = resultado.length > 0 ? resultado[0] : null;
      estadoPolicia = cuartelCercano ? 'SIMULADO' : 'SIN_COBERTURA';
    }

    // 2. Obtener usuario demo
    const usuarioDemo = await this.usuarioRepo.findOne({
      where: { email: 'demo@safealert.cl' },
    });

    // 3. Crear y guardar registro
    const nuevaAlerta = this.alertaRepo.create({
      tipo: 'EMERGENCIA_SOS',
      latitud: lat,
      longitud: lon,
      estado: 'ACTIVA',
      mensajePoliciaEstado: estadoPolicia,
      cuartel: cuartelCercano ? ({ id: cuartelCercano.id } as Cuartel) : null,
      usuario: usuarioDemo ? usuarioDemo : null,
    });

    const guardada = await this.alertaRepo.save(nuevaAlerta);

    return {
      mensaje: 'Alerta registrada exitosamente',
      id: guardada.id,
      alertaId: guardada.id,
      policiaNotificada: notificarPolicia,
      cuartelAsignado: cuartelCercano ? cuartelCercano.nombre : null,
      distanciaKm: cuartelCercano ? Number(cuartelCercano.distancia_km).toFixed(2) : null,
    };
  }
}