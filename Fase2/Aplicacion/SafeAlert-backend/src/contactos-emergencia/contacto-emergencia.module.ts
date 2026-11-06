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
      tokenConfirmacion,
      usuario: { id: usuarioId } as Usuario,
    });

    const guardado = await this.repo.save(nuevo);

    // Enviar invitación de confirmación por WhatsApp sin bloquear la respuesta
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
   * Genera la página web de confirmación (GET muestra el botón, POST confirma en la BD)
   */
  async generarHtmlConfirmacion(token: string, ejecutarConfirmacion: boolean): Promise<string> {
    const tokenLimpio = token?.trim();
    if (!tokenLimpio || !/^[a-zA-Z0-9-]{10,64}$/.test(tokenLimpio)) {
      return this.plantillaHtml(
        'Enlace no válido',
        'El enlace de confirmación no es válido o ya fue utilizado.',
        false,
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
        'Solicitud ya procesada o expirada',
        'Este enlace ya fue confirmado anteriormente o no se encuentra disponible.',
        false,
        null,
      );
    }

    const nombreUsuario = this.escaparHtml(contacto.usuario?.nombre || 'Un usuario de SafeAlert');
    const nombreContacto = this.escaparHtml(contacto.nombre);

    if (!ejecutarConfirmacion) {
      return this.plantillaHtml(
        `Hola ${nombreContacto}, ¿aceptas ser contacto de confianza?`,
        `<strong>${nombreUsuario}</strong> te ha registrado en su red de apoyo de <strong>SafeAlert</strong>. Si aceptas, recibirás alertas por WhatsApp con su ubicación únicamente cuando active una emergencia S.O.S.`,
        true,
        tokenLimpio,
      );
    }

    // Confirmar el contacto e invalidar el token de un solo uso
    contacto.confirmado = true;
    contacto.tokenConfirmacion = null;
    await this.repo.save(contacto);

    return this.plantillaHtml(
      '¡Solicitud confirmada con éxito!',
      `Gracias, <strong>${nombreContacto}</strong>. Ahora eres parte de la red de confianza verificada de <strong>${nombreUsuario}</strong> en SafeAlert. No necesitas instalar ninguna aplicación.`,
      false,
      null,
    );
  }

  private async enviarSolicitudConfirmacionWhatsApp(
    usuarioId: number,
    contacto: ContactoEmergencia,
    tokenConfirmacion: string,
  ): Promise<void> {
    try {
      const idInstance = process.env.GREEN_API_ID_INSTANCE;
      const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
      const apiHost = (process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '');

      if (!idInstance || !apiTokenInstance) {
        this.logger.warn('Green-API no configurado para enviar invitación de contacto.');
        return;
      }

      const digitos = this.formatearDigitosChile(contacto.telefono);
      if (!digitos) return;

      const usuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
      const nombreUsuario = usuario?.nombre?.trim() || 'Un usuario de SafeAlert';

      // Usamos la URL pública del Frontend con el proxy /api (o BACKEND_PUBLIC_URL)
      const baseUrl = (
        process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/api`
          : process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, '') || 'http://localhost:3000'
      );

      const linkConfirmacion = `${baseUrl}/contactos-emergencia/confirmar/${encodeURIComponent(tokenConfirmacion)}`;

      const mensaje =
        `🛡️ *Red de Confianza · SafeAlert*\n\n` +
        `Hola *${contacto.nombre}*, *${nombreUsuario}* quiere agregarte como su contacto de emergencia.\n\n` +
        `Para autorizar la recepción de sus alertas S.O.S por WhatsApp (sin necesidad de instalar la app), confirma tu solicitud en este enlace:\n` +
        `${linkConfirmacion}\n\n` +
        `_Si no conoces a esta persona, simplemente ignora este mensaje._`;

      const url = `${apiHost}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${digitos}@c.us`,
          message: mensaje,
        }),
      });

      if (!response.ok) {
        this.logger.error(`Error enviando invitación Green-API (${response.status}): ${await response.text()}`);
      } else {
        this.logger.log(`Invitación de confianza enviada por WhatsApp a ${digitos}@c.us`);
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
    mostrarBoton: boolean,
    token: string | null,
  ): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SafeAlert · Red de Confianza</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; background: #f4f7f5; color: #173844; }
    .card { max-width: 440px; width: 100%; background: #ffffff; border: 1px solid #dce6e1; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(23, 63, 73, 0.08); }
    .banner { background: #173f49; color: #ffffff; padding: 24px 26px; }
    .eyebrow { font-size: 10px; letter-spacing: 1.6px; color: #a8d0c7; font-weight: 700; display: block; margin-bottom: 6px; }
    .banner h1 { margin: 0; font-size: 20px; line-height: 1.3; }
    .content { padding: 26px; }
    .content p { margin: 0 0 22px; font-size: 14px; line-height: 1.7; color: #4c6870; }
    .btn { width: 100%; border: 0; background: #246d60; color: #ffffff; padding: 14px 18px; border-radius: 11px; font-size: 14px; font-weight: 650; cursor: pointer; }
    .btn:hover { background: #205b51; }
    .badge-ok { display: inline-block; padding: 8px 12px; border-radius: 9px; background: #eaf4ed; color: #246d60; font-size: 12px; font-weight: 650; }
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
        mostrarBoton && token
          ? `<form method="POST" action="">
               <button type="submit" class="btn">Aceptar y confirmar solicitud</button>
             </form>`
          : `<span class="badge-ok">Proceso completado · Puedes cerrar esta ventana</span>`
      }
    </div>
  </main>
</body>
</html>`;
  }
}