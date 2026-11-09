import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ContactosEmergenciaService } from './contacto-emergencia.service';
import { CrearContactoDto } from './dto/crear-contacto.dto';
import { ActualizarContactoDto } from './dto/actualizar-contacto.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('contactos-emergencia')
export class ContactosEmergenciaController {
  constructor(private readonly contactosService: ContactosEmergenciaService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listar(@Req() req: any) {
    const usuarioId = req.user?.id || req.user?.sub;
    const contactos = await this.contactosService.listar(Number(usuarioId));
    return { contactos };
  }

  @Post()
  @UseGuards(AuthGuard)
  async crear(@Req() req: any, @Body() dto: CrearContactoDto) {
    const usuarioId = req.user?.id || req.user?.sub;
    const contacto = await this.contactosService.crear(Number(usuarioId), dto);
    return { contacto };
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async actualizar(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarContactoDto,
  ) {
    const usuarioId = req.user?.id || req.user?.sub;
    const contacto = await this.contactosService.actualizar(id, Number(usuarioId), dto);
    return { contacto };
  }

  @Post(':id/reenviar')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async reenviarSolicitud(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const usuarioId = req.user?.id || req.user?.sub;
    const contacto = await this.contactosService.reenviarSolicitud(id, Number(usuarioId));
    return { contacto };
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async eliminar(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const usuarioId = req.user?.id || req.user?.sub;
    await this.contactosService.eliminar(id, Number(usuarioId));
  }

  // 1. Pantalla web que ve el contacto al abrir el link desde su WhatsApp
  @Get('confirmar/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async verSolicitudConfirmacion(@Param('token') token: string) {
    return await this.contactosService.generarHtmlConfirmacion(token, 'VER');
  }

  // 2. Acción cuando el contacto presiona "Aceptar y confirmar"
  @Post('confirmar/:token')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async confirmarSolicitud(@Param('token') token: string) {
    return await this.contactosService.generarHtmlConfirmacion(token, 'ACEPTAR');
  }

  // 3. Acción cuando el contacto presiona "Rechazar solicitud"
  @Post('rechazar/:token')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  async rechazarSolicitud(@Param('token') token: string) {
    return await this.contactosService.generarHtmlConfirmacion(token, 'RECHAZAR');
  }
}