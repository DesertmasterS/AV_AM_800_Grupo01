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
import { AlertasService } from './alertas.service';
import { CrearAlertaDto } from './dto/crear-alerta.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('alerta')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async registrarAlerta(@Body() dto: CrearAlertaDto, @Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.crearAlerta(dto, usuarioId);
  }

  @Get('activa')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async obtenerAlertaActiva(@Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.obtenerAlertaActiva(usuarioId);
  }

  @Get('compartidas')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async obtenerCompartidas(@Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.obtenerAlertasCompartidasConmigo(usuarioId);
  }

  @Patch(':id/detener')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async detenerAlerta(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.detenerAlerta(id, usuarioId);
  }

  // Ruta POST equivalente para compatibilidad con HttpURLConnection de Android nativo
  @Post(':id/detener')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async detenerAlertaPost(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.detenerAlerta(id, usuarioId);
  }

  @Patch(':id/ubicacion')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async actualizarUbicacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { latitud: number; longitud: number },
    @Req() req: Request,
  ) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.actualizarUbicacion(
      id,
      body.latitud,
      body.longitud,
      usuarioId,
    );
  }

  @Get('historial')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async obtenerHistorial(@Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.obtenerHistorial(usuarioId);
  }

  // Acceso por código UUID secreto (eventoId) enviado en el enlace de WhatsApp
  @Get('publica/:codigo')
  @HttpCode(HttpStatus.OK)
  async obtenerAlertaPublica(@Param('codigo') codigo: string) {
    return await this.alertasService.obtenerAlertaPorCodigo(codigo);
  }
}