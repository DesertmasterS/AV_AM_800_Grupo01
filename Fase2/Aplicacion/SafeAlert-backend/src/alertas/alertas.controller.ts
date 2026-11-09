import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AlertasService } from './alertas.service';
import { CrearAlertaDto } from './dto/crear-alerta.dto';
import { ActualizarUbicacionDto } from './dto/actualizar-ubicacion.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('alerta')
export class AlertasController {
  constructor(
    private readonly alertasService: AlertasService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async registrarAlerta(@Body() dto: CrearAlertaDto, @Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.crearAlerta(dto, Number(usuarioId));
  }

  @Get('activa')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async obtenerAlertaActiva(@Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.obtenerAlertaActiva(Number(usuarioId));
  }

  @Get('compartidas')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async obtenerCompartidas(@Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.obtenerAlertasCompartidasConmigo(Number(usuarioId));
  }

  @Patch(':id/detener')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async detenerAlerta(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.detenerAlerta(id, Number(usuarioId));
  }

  @Post(':id/detener')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async detenerAlertaPost(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.detenerAlerta(id, Number(usuarioId));
  }

  @Patch(':id/ubicacion')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async actualizarUbicacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUbicacionDto,
    @Req() req: Request,
  ) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.actualizarUbicacion(
      id,
      dto.latitud,
      dto.longitud,
      Number(usuarioId),
    );
  }

  @Get('historial')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async obtenerHistorial(@Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.obtenerHistorial(Number(usuarioId));
  }

  // Lee la cookie safealert_session (si existe) para reconocer al dueño de la alerta #103
  @Get('publica/:codigo')
  @HttpCode(HttpStatus.OK)
  async obtenerAlertaPublica(@Param('codigo') codigo: string, @Req() req: Request) {
    let usuarioIdSesion: number | undefined;
    const token =
      req.cookies?.['safealert_session'] ||
      req.headers.authorization?.split(' ')[1];

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const sub = payload?.id ?? payload?.sub;
        if (sub) usuarioIdSesion = Number(sub);
      } catch {
        // Sin sesión válida: solo podrá entrar si envía el UUID eventoId completo
      }
    }

    return await this.alertasService.obtenerAlertaPorCodigo(codigo, usuarioIdSesion);
  }
}