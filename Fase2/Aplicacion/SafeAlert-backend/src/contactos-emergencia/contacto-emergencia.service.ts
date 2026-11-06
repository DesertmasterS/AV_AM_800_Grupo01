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

  // Memoria de protección anti-spam: evita reenviar invitaciones si borran y vuelven a crear el contacto
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
      tokenConfirmacion,
      usuario: { id: usuarioId } as Usuario,
    });

    const guardado = await this.repo.save(nuevo);

    // Enviar invitación única por WhatsApp sin bloquear la respuesta
    void this.enviarSolicitudConfirmacionWhatsApp(usuarioId, guardado, tokenConfirmacion);

    // No exponer el token secreto en la respuesta JSON al cliente
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

    let nuevoToken: string | null = null;
    if (cambioTelefono) {
      nuevoToken = randomUUID();
      contacto.confirmado = false;
      contacto.rechazado = false;
      contacto.tokenConfirmacion = nuevoToken;
    }

    const actualizado = await this.repo.save(contacto);

    if (cambioTelefono && nuevoToken) {
      void this.enviarSolicitudConfirmacionWhatsApp(usuarioId, actualizado, nuevoToken);
    }

    delete (actualizado as Partial<ContactoEmergencia>).tokenConfirmacion;
    return actualizado;
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
   * Genera la página web de confirmación o rechazo (GET muestra los botones, POST confirma o rechaza en la BD)
   */
  async generarHtmlConfirmacion(
    token: string,
    accion: 'VER' | 'ACEPTAR' | 'RECHAZAR',
  ): Promise<string> {
    const tokenLimpio = token?.trim();
    if (!tokenLimpio || !/^[a-zA-Z0-9-]{10,64}$/.test(tokenLimpio)) {
      return this.plantillaHtml(
        'Enlace no válido',
        'El enlace de solicitud no es válido o ya fue procesado anteriormente.',
        null,
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
        'Solicitud ya procesada',
        'Esta solicitud ya fue respondida anteriormente o no se encuentra disponible.',
        null,
      );
    }

    // Expiración de seguridad: los enlaces de invitación caducan a las 48 horas
    const edadMs = Date.now() - new Date(contacto.creadoEn).getTime();
    if (edadMs > 48 * 60 * 60 * 1000) {
      contacto.tokenConfirmacion = null;
      await this.repo.save(contacto);
      return this.plantillaHtml(
        'Enlace expirado',
        'Por seguridad, las solicitudes de contacto caducan a las 48 horas.',
        null,
      );
    }

    const nombreUsuario = this.escaparHtml(contacto.usuario?.nombre || 'Un usuario de SafeAlert');
    const nombreContacto = this.escaparHtml(contacto.nombre);

    if (accion === 'VER') {
      return this.plantillaHtml(
        `Hola ${nombreContacto}, ¿aceptas ser contacto de confianza?`,
        `<strong>${nombreUsuario}</strong> quiere agregarte a su red de apoyo en <strong>SafeAlert</strong>.<br><br>Si aceptas, recibirás alertas por WhatsApp únicamente cuando active una emergencia S.O.S. Si no deseas recibir mensajes, puedes rechazar la solicitud y no volveremos a escribirte.`,
        tokenLimpio,
      );
    }

    if (accion === 'RECHAZAR') {
      contacto.confirmado = false;
      contacto.rechazado = true;
      contacto.tokenConfirmacion = null;
      await this.repo.save(contacto);

      const digitos = this.formatearDigitosChile(contacto.telefono);
      if (digitos) {
        this.historialEnvios.set(`${contacto.usuario?.id ?? 0}:${digitos}`, {
          ultimoEnvioMs: Date.now(),
          bloqueadoPorRechazo: true,
        });
      }

      return this.plantillaHtml(
        'Solicitud rechazada',
        `Hemos registrado tu decisión, <strong>${nombreContacto}</strong>. Tu número ha sido bloqueado para este usuario y <strong>no recibirás más solicitudes ni alertas</strong> de su parte.`,
        null,
      );
    }

    // Acción === 'ACEPTAR'
    contacto.confirmado = true;
    contacto.rechazado = false;
    contacto.tokenConfirmacion = null;
    await this.repo.save(contacto);

    return this.plantillaHtml(
      '¡Solicitud confirmada con éxito!',
      `Gracias, <strong>${nombreContacto}</strong>. Ahora eres parte de la red de confianza verificada de <strong>${nombreUsuario}</strong> en SafeAlert. No necesitas instalar ninguna aplicación.`,
      null,
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

      // Escudo Anti-Spam: verificar si este número ya rechazó o ya recibió invitación en las últimas 24h
      const claveSpam = `${usuarioId}:${digitos}`;
      const registroPrevio = this.historialEnvios.get(claveSpam);
      const ventana24h = 24 * 60 * 60 * 1000;

      if (registroPrevio?.bloqueadoPorRechazo) {
        this.logger.warn(
          `Envío bloqueado: el número ${digitos} rechazó previamente ser contacto del usuario ${usuarioId}.`,
        );
        contacto.rechazado = true;
        contacto.tokenConfirmacion = null;
        await this.repo.save(contacto);
        return;
      }

      if (registroPrevio && Date.now() - registroPrevio.ultimoEnvioMs < ventana24h) {
        this.logger.warn(
          `Cooldown activo (24h): se omite reenvío de invitación a ${digitos} para evitar spam.`,
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
        `_Este es un mensaje único. Si no confirmas o rechazas la solicitud, no recibirás ningún otro mensaje._`;

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
        this.logger.log(`Invitación única enviada por WhatsApp a ${digitos}@c.us`);
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
  ): string {
    const tokenSeguro = token ? encodeURIComponent(token) : '';
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'self';" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SafeAlert · Red de Confianza</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; background: #f4f7f5; color: #173844; }
    .card { max-width: 440px; width: 100%; background: #ffffff; border: 1px solid #dce6e1; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(23, 63, 73, 0.08); }
    .banner { background: #173f49; color: #ffffff; padding: 24px 26px; }
    .eyebrow { font-size: 10px; letter-spacing: 1.6px; color: #a8d0c7; font-weight: 700; display: block; margin-bottom: 6px; }
    .banner h1 { margin: 0; font-size: 20px; line-height: 1.3; }
    .content { padding: 26px; display: grid; gap: 12px; }
    .content p { margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: #4c6870; }
    .btn { width: 100%; border: 0; background: #246d60; color: #ffffff; padding: 14px 18px; border-radius: 11px; font-size: 14px; font-weight: 650; cursor: pointer; }
    .btn:hover { background: #205b51; }
    .btn-reject { width: 100%; border: 1px solid #efd9d5; background: #fff4f2; color: #9c3b4b; padding: 12px 18px; border-radius: 11px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .badge-ok { display: inline-block; padding: 10px 14px; border-radius: 9px; background: #eaf4ed; color: #246d60; font-size: 12px; font-weight: 650; text-align: center; }
  </style>
</head>
<body>
  <main class="card">
    <header class="banner">
      <span class="eyebrow">SAFEALERT · RED DE CONFIANZA</span>
      <h1>${titulo}</h1>
    </header>
    <div class="content">
      <p>${descripcionHtml}</p>
      ${
        token
          ? `<form method="POST" action="../confirmar/${tokenSeguro}">
               <button type="submit" class="btn">Aceptar y confirmar solicitud</button>
             </form>
             <form method="POST" action="../rechazar/${tokenSeguro}">
               <button type="submit" class="btn-reject">Rechazar (No deseo recibir mensajes)</button>
             </form>`
          : `<span class="badge-ok">Proceso completado · Puedes cerrar esta ventana</span>`
      }
    </div>
  </main>
</body>
</html>`;
  }
}