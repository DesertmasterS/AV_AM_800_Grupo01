import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities/usuario.entity';
import { RegisterDto, LoginDto, UsuarioPublicoDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  private mapToPublic(usuario: Usuario): UsuarioPublicoDto {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? '',
      telefono: usuario.telefono,
      email: usuario.email,
    };
  }

  async registrar(dto: RegisterDto): Promise<{ usuario: UsuarioPublicoDto; token: string }> {
    const emailNorm = dto.email.trim().toLowerCase();

    const existe = await this.usuarioRepo.findOne({ where: { email: emailNorm } });
    if (existe) {
      throw new ConflictException('El correo electrónico ya se encuentra registrado');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const nuevoUsuario = this.usuarioRepo.create({
      nombre: dto.nombre.trim(),
      apellido: dto.apellido.trim(),
      telefono: dto.telefono,
      email: emailNorm,
      passwordHash,
    });

    const guardado = await this.usuarioRepo.save(nuevoUsuario);
    const token = this.jwtService.sign({ sub: guardado.id, email: guardado.email });

    return { usuario: this.mapToPublic(guardado), token };
  }

  async login(dto: LoginDto): Promise<{ usuario: UsuarioPublicoDto; token: string }> {
    const emailNorm = dto.email.trim().toLowerCase();

    // Consultar explícitamente passwordHash porque tiene select: false
    const usuario = await this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.email = :email', { email: emailNorm })
      .getOne();

    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const claveValida = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!claveValida) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const token = this.jwtService.sign({ sub: usuario.id, email: usuario.email });

    return { usuario: this.mapToPublic(usuario), token };
  }

  async obtenerPerfilPorId(id: number): Promise<UsuarioPublicoDto> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    return this.mapToPublic(usuario);
  }
}