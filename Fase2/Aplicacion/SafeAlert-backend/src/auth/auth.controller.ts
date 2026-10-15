import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

const COOKIE_NAME = 'safealert_session';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  private setSessionCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd, // En producción será true (requiere HTTPS, Cloud Run lo tiene)
      sameSite: isProd ? 'none' : 'lax', // <-- El cambio clave ('none' en vez de 'strict')
      maxAge: 7 * 24 * 60 * 60 * 1000, 
      path: '/',
    });
  }
  @Post('register')
  @HttpCode(HttpStatus.CREATED) // 201
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { usuario, token } = await this.authService.registrar(dto);
    this.setSessionCookie(res, token);
    return { usuario };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) // 200
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { usuario, token } = await this.authService.login(dto);
    this.setSessionCookie(res, token);
    return { usuario };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK) // 200
  async me(@Req() req: Request) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('No hay sesión activa');
    }

    try {
      const payload = this.jwtService.verify(token);
      const usuario = await this.authService.obtenerPerfilPorId(payload.sub);
      return { usuario };
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res({ passthrough: true }) res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax', // <-- Aplicar también aquí para poder borrarla
      path: '/',
    });
  }
}