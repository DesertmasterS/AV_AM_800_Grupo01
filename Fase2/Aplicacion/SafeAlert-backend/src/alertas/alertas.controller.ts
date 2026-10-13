import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AlertasService } from './alertas.service';
import { CrearAlertaDto } from './dto/crear-alerta.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('alerta')
@UseGuards(AuthGuard)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async registrarAlerta(@Body() dto: CrearAlertaDto, @Req() req: Request) {
    const usuarioId = (req as any).user?.id || (req as any).user?.sub;
    return await this.alertasService.crearAlerta(dto, usuarioId);
  }

  @Get('historial')
  @HttpCode(HttpStatus.OK)
  async obtenerHistorial() {
    return await this.alertasService.obtenerHistorial();
  }
}