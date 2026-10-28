import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity';
import { CrearAlertaDto, OrigenAlerta } from './dto/crear-alerta.dto';

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
    const eventoId = dto.eventoId ?? null;
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
      // Si el nuevo disparo por volumen/movimiento trae coordenadas GPS, actualizamos su posición en vivo
      if (tieneLatitud && tieneLongitud) {
        alertaActiva.latitud = dto.latitud!;
        alertaActiva.longitud = dto.longitud!;
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
      mensajePoliciaEstado: 'NO_APLICA',
      cuartel: null,
      usuario,
    });

    try {
      const guardada = await this.alertaRepo.save(nuevaAlerta);

      // Notificar por WhatsApp vía Green-API (sin bloquear si falla la red externa)
      await this.notificarContactosEmergencia(usuario, guardada, origen);

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
      latitud: actualizada.latitud,
      longitud: actualizada.longitud,
      estado: actualizada.estado,
      fecha: actualizada.fecha,
    };
  }

  /**
   * Devuelve los datos de la alerta para el mapa en tiempo real del "Modo Acompañante"
   */
  async obtenerAlertaPublica(alertaId: number) {
    if (!Number.isSafeInteger(alertaId) || alertaId <= 0) {
      throw new BadRequestException('ID de alerta inválido');
    }

    const alerta = await this.alertaRepo.findOne({
      where: { id: alertaId },
      relations: {
        usuario: true,
      },
    });

    if (!alerta) {
      throw new NotFoundException('La alerta solicitada no existe');
    }

    const nombreUsuario =
      (alerta.usuario as { nombre?: string; email?: string })?.nombre ||
      (alerta.usuario as { email?: string })?.email ||
      `Usuario #${alerta.usuario?.id ?? ''}`;

    return {
      id: alerta.id,
      alertaId: alerta.id,
      nombreUsuario,
      tipo: alerta.tipo,
      estado: alerta.estado,
      latitud: alerta.latitud,
      longitud: alerta.longitud,
      fecha: alerta.fecha,
    };
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
  ): Promise<void> {
    try {
      const contactos = await this.contactoRepo.find({
        where: { usuario: { id: usuario.id } },
      });

      if (!contactos.length) {
        this.logger.warn(`El usuario ${usuario.id} no tiene contactos de emergencia registrados.`);
        return;
      }

      const nombreUsuario =
        (usuario as { nombre?: string; email?: string }).nombre ||
        (usuario as { email?: string }).email ||
        `Usuario #${usuario.id}`;

      await Promise.allSettled(
        contactos.map((contacto) =>
          this.enviarWhatsAppGreenApi(
            contacto.telefono,
            contacto.nombre,
            nombreUsuario,
            alerta.id,
            alerta.latitud,
            alerta.longitud,
            origen,
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
    alertaId: number,
    latitud: number | null,
    longitud: number | null,
    origen: OrigenAlerta,
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
    const linkModoAcompanante = `${frontendUrl}/companion?alertaId=${alertaId}`;

    const tieneGps = latitud != null && longitud != null;
    const ubicacionTexto = tieneGps
      ? `https://www.google.com/maps?q=${latitud},${longitud}`
      : 'Esperando señal GPS...';

    const fechaHora = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

    const mensaje =
      `🚨 *ALERTA S.O.S - SafeAlert* 🚨\n\n` +
      `Hola *${nombreContacto}*, *${nombreUsuario}* ha activado una alerta de emergencia.\n\n` +
      `🛰️ *Mapa en TIEMPO REAL (Modo Acompañante):*\n${linkModoAcompanante}\n\n` +
      `📍 *Ubicación Google Maps:*\n${ubicacionTexto}\n\n` +
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
      estado: alerta.estado,
      fecha: alerta.fecha,
    };
  }
}