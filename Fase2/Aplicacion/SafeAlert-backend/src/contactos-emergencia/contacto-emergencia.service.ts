import { CONFIRMACION_ESTILOS } from './confirmacion.styles';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { CrearContactoDto } from './dto/crear-contacto.dto';
import { ActualizarContactoDto } from './dto/actualizar-contacto.dto';

@Injectable()
export class ContactosEmergenciaService {
  private readonly logger = new Logger(ContactosEmergenciaService.name);

  // Memoria de protección anti-spam: evita reenviar invitaciones si borran y vuelven a crear el contacto antes de 48h
  private readonly historialEnvios = new Map<
    string,
    { ultimoEnvioMs: number; bloqueadoPorRechazo: boolean }
  >();

  constructor(
    @InjectRepository(ContactoEmergencia)
    private readonly repo: Repository<ContactoEmergencia>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async listar(usuarioId: number): Promise<ContactoEmergencia[]> {
    return this.repo.find({
      where: { usuario: { id: usuarioId } },
      order: { creadoEn: 'DESC' },
    });
  }

  async crear(usuarioId: number, dto: CrearContactoDto): Promise<ContactoEmergencia> {
    const telefonoExiste = await this.repo.findOne({
      where: {
        usuario: { id: usuarioId },
        telefono: dto.telefono,
      },
    });

    if (telefonoExiste) {
      throw new ConflictException('Ya existe un contacto con ese teléfono');
    }

    const tokenConfirmacion = randomUUID();

    const nuevo = this.repo.create({
      nombre: dto.nombre,
      telefono: dto.telefono,
      relacion: dto.relacion ?? null,
      confirmado: false,
      rechazado: false,
      notificarActivo: true,
      tokenConfirmacion,
      usuario: { id: usuarioId } as Usuario,
    });

    const guardado = await this.repo.save(nuevo);

    await this.enviarSolicitudConfirmacionWhatsApp(usuarioId, guardado, tokenConfirmacion);

    delete (guardado as Partial<ContactoEmergencia>).tokenConfirmacion;
    return guardado;
  }

  async actualizar(
    id: number,
    usuarioId: number,
    dto: ActualizarContactoDto,
  ): Promise<ContactoEmergencia> {
    const contacto = await this.repo.findOne({
      where: { id, usuario: { id: usuarioId } },
    });

    if (!contacto) {
      throw new NotFoundException('Contacto no encontrado');
    }

    let cambioTelefono = false;
    if (dto.telefono && dto.telefono !== contacto.telefono) {
      const duplicado = await this.repo.findOne({
        where: {
          usuario: { id: usuarioId },
          telefono: dto.telefono,
        },
      });

      if (duplicado) {
        throw new ConflictException('Ya existe un contacto con ese teléfono');
      }
      cambioTelefono = true;
    }

    if (dto.nombre !== undefined) contacto.nombre = dto.nombre;
    if (dto.telefono !== undefined) contacto.telefono = dto.telefono;
    if (dto.relacion !== undefined) contacto.relacion = dto.relacion;
    if (dto.notificarActivo !== undefined) contacto.notificarActivo = dto.notificarActivo;

    let nuevoToken: string | null = null;
    if (cambioTelefono) {
      nuevoToken = randomUUID();
      contacto.confirmado = false;
      contacto.rechazado = false;
      contacto.notificarActivo = true;
      contacto.tokenConfirmacion = nuevoToken;
      contacto.creadoEn = new Date();
    }

    const actualizado = await this.repo.save(contacto);

    if (cambioTelefono && nuevoToken) {
      await this.enviarSolicitudConfirmacionWhatsApp(usuarioId, actualizado, nuevoToken);
    }

    delete (actualizado as Partial<ContactoEmergencia>).tokenConfirmacion;
    return actualizado;
  }

  /**
   * Propuesta 3: Permite reenviar la solicitud de WhatsApp únicamente si ya transcurrieron 48 horas
   */
  async reenviarSolicitud(id: number, usuarioId: number): Promise<ContactoEmergencia> {
    const contacto = await this.repo.findOne({
      where: { id, usuario: { id: usuarioId } },
    });

    if (!contacto) {
      throw new NotFoundException('Contacto no encontrado');
    }

    if (contacto.confirmado) {
      throw new ConflictException('Este contacto ya se encuentra confirmado');
    }

    const ventana48h = 48 * 60 * 60 * 1000;
    const tiempoTranscurrido = Date.now() - new Date(contacto.creadoEn).getTime();

    if (tiempoTranscurrido < ventana48h) {
      const horasRestantes = Math.ceil((ventana48h - tiempoTranscurrido) / (60 * 60 * 1000));
      throw new ConflictException(
        `Debes esperar ${horasRestantes}h más antes de poder reenviar la solicitud a este contacto.`,
      );
    }

    const nuevoToken = randomUUID();
    contacto.rechazado = false;
    contacto.confirmado = false;
    contacto.notificarActivo = true;
    contacto.tokenConfirmacion = nuevoToken;
    contacto.creadoEn = new Date();

    const guardado = await this.repo.save(contacto);

    const digitos = this.formatearDigitosChile(contacto.telefono);
    if (digitos) {
      this.historialEnvios.delete(`${usuarioId}:${digitos}`);
    }

    await this.enviarSolicitudConfirmacionWhatsApp(usuarioId, guardado, nuevoToken);

    delete (guardado as Partial<ContactoEmergencia>).tokenConfirmacion;
    return guardado;
  }

  async eliminar(id: number, usuarioId: number): Promise<void> {
    const contacto = await this.repo.findOne({
      where: { id, usuario: { id: usuarioId } },
    });

    if (!contacto) {
      throw new NotFoundException('Contacto no encontrado');
    }

    await this.repo.remove(contacto);
  }

  /**
   * Propuesta 2: Conserva el token durante 48h para que el destinatario pueda revertir si presionó Rechazar por error
   */
  async generarHtmlConfirmacion(
    token: string,
    accion: 'VER' | 'ACEPTAR' | 'RECHAZAR',
  ): Promise<string> {
    const tokenLimpio = token?.trim();
    if (!tokenLimpio || !/^[a-zA-Z0-9-]{10,64}$/.test(tokenLimpio)) {
      return this.plantillaHtml(
        'Enlace no válido',
        'El enlace de solicitud no es válido o ya expiró.',
        null,
        'FINALIZADO',
      );
    }

    const contacto = await this.repo
      .createQueryBuilder('contacto')
      .addSelect('contacto.tokenConfirmacion')
      .leftJoinAndSelect('contacto.usuario', 'usuario')
      .where('contacto.tokenConfirmacion = :token', { token: tokenLimpio })
      .getOne();

    if (!contacto) {
      return this.plantillaHtml(
        'Solicitud no disponible',
        'Este enlace ya expiró o no se encuentra disponible.',
        null,
        'FINALIZADO',
      );
    }

    const edadMs = Date.now() - new Date(contacto.creadoEn).getTime();
    if (edadMs > 48 * 60 * 60 * 1000) {
      contacto.tokenConfirmacion = null;
      await this.repo.save(contacto);
      return this.plantillaHtml(
        'Enlace expirado',
        'Por seguridad, las solicitudes de contacto caducan a las 48 horas.',
        null,
        'FINALIZADO',
      );
    }

    const nombreUsuario = this.escaparHtml(contacto.usuario?.nombre || 'Un usuario de SafeAlert');
    const nombreContacto = this.escaparHtml(contacto.nombre);
    const digitos = this.formatearDigitosChile(contacto.telefono);
    const claveSpam = `${contacto.usuario?.id ?? 0}:${digitos}`;

    if (accion === 'VER') {
      if (contacto.rechazado) {
        return this.plantillaHtml(
          'Solicitud actualmente rechazada',
          `Hola <strong>${nombreContacto}</strong>, habías rechazado la solicitud de <strong>${nombreUsuario}</strong>.<br><br>Si presionaste rechazar por equivocación, puedes cambiar tu decisión aquí abajo:`,
          tokenLimpio,
          'SOLO_ACEPTAR',
        );
      }
      if (contacto.confirmado) {
        return this.plantillaHtml(
          'Ya eres contacto confirmado',
          `Hola <strong>${nombreContacto}</strong>, ya formas parte de la red de confianza de <strong>${nombreUsuario}</strong>. Si deseas dejar de recibir sus alertas, puedes darte de baja aquí:`,
          tokenLimpio,
          'SOLO_RECHAZAR',
        );
      }
      return this.plantillaHtml(
        `Hola ${nombreContacto}, ¿aceptas ser contacto de confianza?`,
        `<strong>${nombreUsuario}</strong> quiere agregarte a su red de apoyo en <strong>SafeAlert</strong>.<br><br>Si aceptas, recibirás alertas por WhatsApp únicamente cuando active una emergencia S.O.S. Si no deseas recibir mensajes, puedes rechazar la solicitud.`,
        tokenLimpio,
        'AMBOS',
      );
    }

    if (accion === 'RECHAZAR') {
      contacto.confirmado = false;
      contacto.rechazado = true;
      await this.repo.save(contacto);

      if (digitos) {
        this.historialEnvios.set(claveSpam, {
          ultimoEnvioMs: Date.now(),
          bloqueadoPorRechazo: true,
        });
      }

      return this.plantillaHtml(
        'Solicitud rechazada',
        `Hemos registrado tu decisión, <strong>${nombreContacto}</strong>. No recibirás solicitudes ni alertas de <strong>${nombreUsuario}</strong>.<br><br><em>¿Presionaste rechazar por equivocación? Puedes revertirlo con el botón de abajo:</em>`,
        tokenLimpio,
        'SOLO_ACEPTAR',
      );
    }

    // Acción === 'ACEPTAR' (también revierte si antes había rechazado por error)
    contacto.confirmado = true;
    contacto.rechazado = false;
    contacto.notificarActivo = true;
    await this.repo.save(contacto);

    if (digitos) {
      this.historialEnvios.set(claveSpam, {
        ultimoEnvioMs: Date.now(),
        bloqueadoPorRechazo: false,
      });
    }

    return this.plantillaHtml(
      '¡Solicitud confirmada con éxito!',
      `Gracias, <strong>${nombreContacto}</strong>. Ahora eres parte de la red de confianza verificada de <strong>${nombreUsuario}</strong> en SafeAlert. No necesitas instalar ninguna aplicación.`,
      tokenLimpio,
      'SOLO_RECHAZAR',
    );
  }

  private async enviarSolicitudConfirmacionWhatsApp(
    usuarioId: number,
    contacto: ContactoEmergencia,
    tokenConfirmacion: string,
  ): Promise<void> {
    try {
      const digitos = this.formatearDigitosChile(contacto.telefono);
      if (!digitos) return;

      const claveSpam = `${usuarioId}:${digitos}`;
      const registroPrevio = this.historialEnvios.get(claveSpam);
      const ventana48h = 48 * 60 * 60 * 1000;

      if (registroPrevio?.bloqueadoPorRechazo && Date.now() - registroPrevio.ultimoEnvioMs < ventana48h) {
        this.logger.warn(
          `Envío bloqueado (48h): el número ${digitos} rechazó previamente ser contacto del usuario ${usuarioId}.`,
        );
        contacto.rechazado = true;
        await this.repo.save(contacto);
        return;
      }

      if (registroPrevio && Date.now() - registroPrevio.ultimoEnvioMs < ventana48h) {
        this.logger.warn(
          `Cooldown activo (48h): se omite reenvío de invitación a ${digitos} para evitar spam.`,
        );
        return;
      }

      const idInstance = process.env.GREEN_API_ID_INSTANCE;
      const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
      const apiHost = (process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '');

      if (!idInstance || !apiTokenInstance) {
        this.logger.warn('Green-API no configurado para enviar invitación de contacto.');
        return;
      }

      const usuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
      const nombreUsuario = usuario?.nombre?.trim() || 'Un usuario de SafeAlert';

      const baseUrl = (
        process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/api`
          : process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, '') || 'http://localhost:3000'
      );

      const linkConfirmacion = `${baseUrl}/contactos-emergencia/confirmar/${encodeURIComponent(tokenConfirmacion)}`;

      const mensaje =
        `🛡️ *Red de Confianza · SafeAlert*\n\n` +
        `Hola *${contacto.nombre}*, *${nombreUsuario}* quiere agregarte como su contacto de emergencia.\n\n` +
        `Para *aceptar o rechazar* esta solicitud (sin instalar ninguna aplicación), ingresa aquí:\n` +
        `${linkConfirmacion}\n\n` +
        `_Este enlace tiene una validez de 48 horas. Si no confirmas la solicitud, no recibirás alertas._`;

      const url = `${apiHost}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${digitos}@c.us`,
          message: mensaje,
        }),
      });

      if (response.ok) {
        this.historialEnvios.set(claveSpam, {
          ultimoEnvioMs: Date.now(),
          bloqueadoPorRechazo: false,
        });
        this.logger.log(`Invitación enviada por WhatsApp a ${digitos}@c.us`);
      } else {
        this.logger.error(
          `Error enviando invitación Green-API (${response.status}): ${await response.text()}`,
        );
      }
    } catch (err) {
      this.logger.error('Error al enviar invitación de contacto por WhatsApp:', err);
    }
  }

  private formatearDigitosChile(telefono: string | undefined | null): string | null {
    if (!telefono) return null;
    const digitos = telefono.replace(/\D/g, '');
    if (!digitos) return null;
    if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`;
    if (digitos.length === 8) return `569${digitos}`;
    return digitos;
  }

  private escaparHtml(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private plantillaHtml(
    titulo: string,
    descripcionHtml: string,
    token: string | null,
    modoBotones: 'AMBOS' | 'SOLO_ACEPTAR' | 'SOLO_RECHAZAR' | 'FINALIZADO' = 'FINALIZADO',
  ): string {
    const tokenSeguro = token ? encodeURIComponent(token) : '';

    let botonesHtml = `<span class="badge-ok">Proceso completado · Puedes cerrar esta ventana</span>`;

    if (token && modoBotones === 'AMBOS') {
      botonesHtml = `
        <form method="POST" action="../confirmar/${tokenSeguro}">
          <button type="submit" class="btn">Aceptar y confirmar solicitud</button>
        </form>
        <form method="POST" action="../rechazar/${tokenSeguro}">
          <button type="submit" class="btn-reject">Rechazar (No deseo recibir mensajes)</button>
        </form>`;
    } else if (token && modoBotones === 'SOLO_ACEPTAR') {
      botonesHtml = `
        <form method="POST" action="../confirmar/${tokenSeguro}">
          <button type="submit" class="btn">¿Fue un error? Aceptar y confirmar solicitud</button>
        </form>`;
    } else if (token && modoBotones === 'SOLO_RECHAZAR') {
      botonesHtml = `
        <span class="badge-ok">✅ Contacto verificado · Puedes cerrar esta ventana</span>
        <form method="POST" action="../rechazar/${tokenSeguro}">
          <button type="submit" class="btn-reject">Darse de baja / Rechazar</button>
        </form>`;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SafeAlert · Red de Confianza</title>
  <style>${CONFIRMACION_ESTILOS}</style>
</head>
<body>
  <main class="card">
    <header class="banner">
      <span class="eyebrow">SAFEALERT · RED DE CONFIANZA</span>
      <h1>${titulo}</h1>
    </header>
    <div class="content">
      <p>${descripcionHtml}</p>
      ${botonesHtml}
    </div>
  </main>
</body>
</html>`;
  }
}