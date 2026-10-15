import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactoEmergencia } from '../database/entities/contacto-emergencia.entity'; // Ajusta la ruta a tu entidad
import { Usuario } from '../database/entities/usuario.entity'; // Ajusta la ruta a tu entidad Usuario
import { CrearContactoDto } from './dto/crear-contacto.dto';
import { ActualizarContactoDto } from './dto/actualizar-contacto.dto';

@Injectable()
export class ContactosEmergenciaService {
  constructor(
    @InjectRepository(ContactoEmergencia)
    private readonly repo: Repository<ContactoEmergencia>,
  ) {}

  async listar(usuarioId: number): Promise<ContactoEmergencia[]> {
    return this.repo.find({
      where: { usuario: { id: usuarioId } },
      order: { creadoEn: 'DESC' },
    });
  }

  async crear(usuarioId: number, dto: CrearContactoDto): Promise<ContactoEmergencia> {
    // 1. Validar si el teléfono ya existe para este usuario (devuelve 409 Conflict)
    const telefonoExiste = await this.repo.findOne({
      where: {
        usuario: { id: usuarioId },
        telefono: dto.telefono,
      },
    });

    if (telefonoExiste) {
      throw new ConflictException('Ya existe un contacto con ese teléfono');
    }

  // 2. Crear y asociar con la entidad Usuario
    const nuevo = this.repo.create({
      nombre: dto.nombre,
      telefono: dto.telefono,
      relacion: dto.relacion ?? null,
      usuario: { id: usuarioId } as Usuario,
    });

  return await this.repo.save(nuevo);
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

    // Si viene a cambiar el teléfono, verificar que no colisione con otro
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
    }

    if (dto.nombre !== undefined) contacto.nombre = dto.nombre;
    if (dto.telefono !== undefined) contacto.telefono = dto.telefono;
    if (dto.relacion !== undefined) contacto.relacion = dto.relacion;

    return await this.repo.save(contacto);
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
}