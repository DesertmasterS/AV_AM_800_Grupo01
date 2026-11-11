import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity';
import { CrearAlertaDto, OrigenAlerta } from './dto/crear-alerta.dto';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    @InjectRepository(Alerta) private readonly alertaRepo: Repository<Alerta>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(ContactoEmergencia)
    private readonly contactoRepo: Repository<ContactoEmergencia>,
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
    const eventoId = dto.eventoId?.trim() || randomUUID();
    if (eventoId) {
      const existente = await this.buscarEvento(eventoId, usuarioId);
      if (existente) return this.respuesta(existente, usuarioId, true);
    }

    // Verificar si el usuario YA tiene una alerta ACTIVA (por botón, volumen o movimiento)
    const alertaActiva = await this.alertaRepo.findOne({
      where: { usuario: { id: usuarioId }, estado: 'ACTIVA' },
      order: { fecha: 'DESC' },
    });

    if (alertaActiva) {
      let requiereGuardar = false;
      if (!alertaActiva.eventoId) {
        alertaActiva.eventoId = eventoId;
        requiereGuardar = true;
      }
      if (tieneLatitud && tieneLongitud) {
        alertaActiva.latitud = dto.latitud!;
        alertaActiva.longitud = dto.longitud!;
        requiereGuardar = true;
      }
      if (requiereGuardar) {
        await this.alertaRepo.save(alertaActiva);
      }
      return {
        ...this.respuesta(alertaActiva, usuarioId, true),
        yaActiva: true,
        mensaje: `Ya tienes la Alerta #${alertaActiva.id} activa en este momento.`,
      };
    }

    const nuevaAlerta = this.alertaRepo.create({
      tipo: 'EMERGENCIA_' + (origen === OrigenAlerta.BOTON ? 'SOS' : origen),
      eventoId,
      latitud: tieneLatitud ? dto.latitud! : null,
      longitud: tieneLongitud ? dto.longitud! : null,
      estado: 'ACTIVA',
      usuario,
    });

    try {
      const guardada = await this.alertaRepo.save(nuevaAlerta);

      // Notificar por WhatsApp vía Green-API (sin bloquear si falla la red externa)
      await this.notificarContactosEmergencia(usuario, guardada, origen, dto.bateriaPorcentaje);

      return this.respuesta(guardada, usuarioId, false);
    } catch (error: unknown) {
      const code = (error as { driverError?: { code?: string } })?.driverError?.code;
      if (eventoId && code === '23505') {
        const existente = await this.buscarEvento(eventoId, usuarioId);
        if (existente) return this.respuesta(existente, usuarioId, true);
      }
      throw error;
    }
  }

  /**
   * Actualiza en tiempo real las coordenadas GPS de una alerta activa
   */
  async actualizarUbicacion(
    alertaId: number,
    latitud: number,
    longitud: number,
    usuarioId?: number,
  ) {
    this.validarUsuarioId(usuarioId);

    if (latitud == null || longitud == null || Number.isNaN(Number(latitud)) || Number.isNaN(Number(longitud))) {
      throw new BadRequestException('Debes enviar latitud y longitud válidas');
    }

    const alerta = await this.alertaRepo.findOne({
      where: { id: alertaId, usuario: { id: usuarioId } },
    });

    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada para este usuario');
    }

    alerta.latitud = Number(latitud);
    alerta.longitud = Number(longitud);
    const actualizada = await this.alertaRepo.save(alerta);

    return {
      mensaje: 'Ubicación en tiempo real actualizada',
      id: actualizada.id,
      alertaId: actualizada.id,
      eventoId: actualizada.eventoId,
      latitud: actualizada.latitud,
      longitud: actualizada.longitud,
      estado: actualizada.estado,
      fecha: actualizada.fecha,
    };
  }

  async obtenerAlertaPorCodigo(codigo: string, usuarioIdSesion?: number) {
    const codigoLimpio = codigo?.trim();
    if (!codigoLimpio || codigoLimpio === 'undefined' || codigoLimpio === 'null') {
      throw new BadRequestException('Código de seguimiento inválido');
    }

    let alerta: Alerta | null = null;

    // 1. Si viene el código UUID (eventoId)
    if (/^[a-zA-Z0-9-]{16,64}$/.test(codigoLimpio)) {
      alerta = await this.alertaRepo.findOne({
        where: { eventoId: codigoLimpio },
        relations: { usuario: true },
      });
    }
    // 2. Si viene el ID numérico (ej. /alerta/publica/103 desde el botón del Home)
    else if (/^\d+$/.test(codigoLimpio) && usuarioIdSesion) {
      const idNumerico = Number(codigoLimpio);
      const candidata = await this.alertaRepo.findOne({
        where: { id: idNumerico },
        relations: { usuario: true },
      });

      if (candidata) {
        const creadorId = Number(candidata.usuario?.id);

        // Si el usuario con sesión iniciada es el dueño que generó la alerta #103
        if (creadorId > 0 && creadorId === Number(usuarioIdSesion)) {
          alerta = candidata;
        } else if (creadorId > 0) {
          // O si es un contacto de confianza confirmado y activo del dueño
          const miUsuario = await this.usuarioRepo.findOne({ where: { id: Number(usuarioIdSesion) } });
          const misDigitos = this.formatearDigitosChile(miUsuario?.telefono);
          const contactos = await this.contactoRepo.find({
            where: {
              usuario: { id: creadorId },
              confirmado: true,
              rechazado: false,
              notificarActivo: true,
            },
          });
          if (contactos.some((c) => this.formatearDigitosChile(c.telefono) === misDigitos)) {
            alerta = candidata;
          }
        }
      }
    }

    if (!alerta) {
      throw new NotFoundException('La alerta solicitada no existe o no tienes acceso');
    }

    const nombreSeguro =
      (alerta.usuario as { nombre?: string } | null)?.nombre?.trim() || 'Usuario SafeAlert';

    const esDueno = Boolean(
      usuarioIdSesion && Number(alerta.usuario?.id) === Number(usuarioIdSesion),
    );
    const mostrarCoordenadas = alerta.estado === 'ACTIVA' || esDueno;

    return {
      id: alerta.id,
      alertaId: alerta.id,
      eventoId: alerta.eventoId,
      nombreUsuario: nombreSeguro,
      tipo: alerta.tipo,
      estado: alerta.estado,
      latitud: mostrarCoordenadas ? alerta.latitud : null,
      longitud: mostrarCoordenadas ? alerta.longitud : null,
      fecha: alerta.fecha,
    };
  }

  async obtenerAlertasCompartidasConmigo(usuarioId?: number) {
    this.validarUsuarioId(usuarioId);
    const miUsuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
    if (!miUsuario) throw new UnauthorizedException('Sesión no disponible');

    const misDigitos = this.formatearDigitosChile(miUsuario.telefono);
    const ultimosOcho = misDigitos ? misDigitos.slice(-8) : '';

    let idsConfiaron: number[] = [];
    if (ultimosOcho.length === 8) {
      const coincidencias = await this.contactoRepo
        .createQueryBuilder('contacto')
        .innerJoinAndSelect('contacto.usuario', 'usuario')
        .where("RIGHT(REGEXP_REPLACE(contacto.telefono, '\\D', '', 'g'), 8) = :ultimosOcho", {
          ultimosOcho,
        })
        .andWhere('contacto.confirmado = true')
        .andWhere('contacto.rechazado = false')
        .andWhere('contacto.notificarActivo = true')
        .getMany();

      idsConfiaron = coincidencias.map((c) => c.usuario.id);
    }

    const idsAutorizados = Array.from(new Set([usuarioId, ...idsConfiaron]));

    const alertas = await this.alertaRepo
      .createQueryBuilder('alerta')
      .leftJoinAndSelect('alerta.usuario', 'usuario')
      .where('usuario.id IN (:...ids)', { ids: idsAutorizados })
      .andWhere('alerta.eventoId IS NOT NULL')
      .orderBy('alerta.fecha', 'DESC')
      .take(15)
      .getMany();

    return alertas.map((a) => ({
      id: a.id,
      alertaId: a.id,
      eventoId: a.eventoId,
      nombreUsuario: a.usuario?.nombre?.trim() || 'Usuario SafeAlert',
      tipo: a.tipo,
      estado: a.estado,
      latitud: a.estado === 'ACTIVA' ? a.latitud : null,
      longitud: a.estado === 'ACTIVA' ? a.longitud : null,
      fecha: a.fecha,
    }));
  }

  async obtenerHistorial(usuarioId: number) {
    this.validarUsuarioId(usuarioId);
    return this.alertaRepo.find({
      where: { usuario: { id: usuarioId } },
      order: { fecha: 'DESC' },
      take: 20,
    });
  }

  /**
   * Busca los contactos del usuario y les envía el WhatsApp de emergencia vía Green-API
   */
  private async notificarContactosEmergencia(
    usuario: Usuario,
    alerta: Alerta,
    origen: OrigenAlerta,
    bateriaPorcentaje?: number,
  ): Promise<void> {
    try {
      const contactos = await this.contactoRepo.find({
        where: {
          usuario: { id: usuario.id },
          confirmado: true,
          rechazado: false,
          notificarActivo: true, // <-- Solo envía a contactos confirmados con notificaciones activas
        },
      });

      if (!contactos.length) {
        this.logger.warn(
          `El usuario ${usuario.id} no tiene contactos de emergencia confirmados con envío activo.`,
        );
        return;
      }

      const nombreUsuario =
        (usuario as { nombre?: string; email?: string }).nombre ||
        (usuario as { email?: string }).email ||
        `Usuario #${usuario.id}`;

      const codigoSecreto = alerta.eventoId || String(alerta.id);

      await Promise.allSettled(
        contactos.map((contacto) =>
          this.enviarWhatsAppGreenApi(
            contacto.telefono,
            contacto.nombre,
            nombreUsuario,
            codigoSecreto,
            alerta.latitud,
            alerta.longitud,
            origen,
            bateriaPorcentaje,
          ),
        ),
      );
    } catch (err) {
      this.logger.error('Error al procesar el envío a contactos de emergencia:', err);
    }
  }

  /**
   * Envía el mensaje personalizado + ubicación en tiempo real usando Green-API
   */
  private async enviarWhatsAppGreenApi(
    telefonoDestino: string,
    nombreContacto: string,
    nombreUsuario: string,
    codigoEvento: string,
    latitud: number | null,
    longitud: number | null,
    origen: OrigenAlerta,
    bateriaPorcentaje?: number,
  ): Promise<void> {
    const idInstance = process.env.GREEN_API_ID_INSTANCE;
    const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
    const apiHost = (process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '');

    if (!idInstance || !apiTokenInstance) {
      this.logger.warn('GREEN_API_ID_INSTANCE o GREEN_API_TOKEN_INSTANCE no configurados en el entorno.');
      return;
    }

    const numeroSinMas = this.formatearDigitosChile(telefonoDestino);
    if (!numeroSinMas) {
      this.logger.warn(`Número de contacto inválido omitido: ${telefonoDestino}`);
      return;
    }

    // Formato requerido por Green-API: "569XXXXXXXX@c.us"
    const chatId = `${numeroSinMas}@c.us`;

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:8100').replace(/\/$/, '');
    // Enlace seguro con el UUID eventoId (?codigo=...)
    const linkModoAcompanante = `${frontendUrl}/companion?codigo=${encodeURIComponent(codigoEvento)}`;

    const tieneGps = latitud != null && longitud != null;
    const ubicacionTexto = tieneGps
      ? `https://www.google.com/maps?q=${latitud},${longitud}`
      : 'Esperando señal GPS...';

    const fechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

    const bateriaTexto = bateriaPorcentaje == null ? 'No disponible' : `${bateriaPorcentaje}%`;

    const mensaje =
      `🚨 *ALERTA S.O.S - SafeAlert* 🚨\n\n` +
      `Hola *${nombreContacto}*, *${nombreUsuario}* ha activado una alerta de emergencia.\n\n` +
      `🛰️ *Mapa en TIEMPO REAL (Modo Acompañante):*\n${linkModoAcompanante}\n\n` +
      `📍 *Ubicación Google Maps:*\n${ubicacionTexto}\n\n` +
      `🔋 *Batería al enviar:* ${bateriaTexto}\n\n` +
      `⚡ *Método:* ${origen} | 🕒 *Hora:* ${fechaHora}\n\n` +
      `_Abre el enlace del Modo Acompañante para seguir su recorrido en vivo._`;

    const url = `${apiHost}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId,
        message: mensaje,
      }),
    });

    if (!response.ok) {
      const errorDetalle = await response.text();
      this.logger.error(`Fallo envío Green-API a ${chatId} (${response.status}): ${errorDetalle}`);
      return;
    }

    this.logger.log(`WhatsApp enviado con éxito vía Green-API a ${chatId}`);
  }

  /**
   * Normaliza teléfonos chilenos a solo dígitos con código de país (ej: "56933845556")
   */
  private formatearDigitosChile(telefono: string | undefined | null): string | null {
    if (!telefono) return null;
    const digitos = telefono.replace(/\D/g, '');
    if (!digitos) return null;

    if (digitos.length === 9 && digitos.startsWith('9')) {
      return `56${digitos}`;
    }
    if (digitos.length === 8) {
      return `569${digitos}`;
    }
    return digitos;
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
      id: alerta.id,
      alertaId: alerta.id,
      usuarioId,
      origen:
        alerta.tipo === 'EMERGENCIA_MOVIMIENTO'
          ? OrigenAlerta.MOVIMIENTO
          : alerta.tipo === 'EMERGENCIA_VOLUMEN'
            ? OrigenAlerta.VOLUMEN
            : OrigenAlerta.BOTON,
      eventoId: alerta.eventoId,
      duplicada,
      latitud: alerta.latitud,
      longitud: alerta.longitud,
      fecha: alerta.fecha,
    };
  }

  /**
   * Consulta si el usuario tiene una alerta en estado ACTIVA actualmente
   */
  async obtenerAlertaActiva(usuarioId?: number) {
    this.validarUsuarioId(usuarioId);
    const activa = await this.alertaRepo.findOne({
      where: { usuario: { id: usuarioId }, estado: 'ACTIVA' },
      order: { fecha: 'DESC' },
    });

    if (!activa) return { activa: null };

    return {
      activa: {
        id: activa.id,
        alertaId: activa.id,
        eventoId: activa.eventoId,
        tipo: activa.tipo,
        estado: activa.estado,
        latitud: activa.latitud,
        longitud: activa.longitud,
        fecha: activa.fecha,
      },
    };
  }

  /**
   * Detiene la alerta activa del usuario y la marca como FINALIZADA en Neon DB
   */
  async detenerAlerta(alertaId: number, usuarioId?: number) {
    this.validarUsuarioId(usuarioId);

    const alerta = await this.alertaRepo.findOne({
      where: { id: alertaId, usuario: { id: usuarioId } },
    });

    if (!alerta) {
      throw new NotFoundException('No se encontró la alerta para este usuario');
    }

    // Marcar como FINALIZADA esta alerta y cualquier otra que haya quedado ACTIVA anteriormente
    await this.alertaRepo.update(
      { usuario: { id: usuarioId }, estado: 'ACTIVA' },
      { estado: 'FINALIZADA' },
    );

    alerta.estado = 'FINALIZADA';

    return {
      mensaje: `Alerta #${alerta.id} detenida y finalizada correctamente`,
      id: alerta.id,
      alertaId: alerta.id,
      eventoId: alerta.eventoId,
      estado: alerta.estado,
      fecha: alerta.fecha,
    };
  }
}