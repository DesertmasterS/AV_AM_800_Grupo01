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
} from '@nestjs/common';
import { ContactosEmergenciaService } from './contacto-emergencia.service';
import { CrearContactoDto } from './dto/crear-contacto.dto';
import { ActualizarContactoDto } from './dto/actualizar-contacto.dto';
import { AuthGuard } from '../auth/auth.guard'; // Ajusta la ruta a tu AuthGuard



@UseGuards(AuthGuard)
@Controller('contactos-emergencia')
export class ContactosEmergenciaController {
  constructor(private readonly contactosService: ContactosEmergenciaService) {}

  @Get()
  async listar(@Req() req: any) {
    const usuarioId = req.user.sub;
    const contactos = await this.contactosService.listar(usuarioId);
    return { contactos };
  }

  @Post()
  async crear(@Req() req: any, @Body() dto: CrearContactoDto) {
    const usuarioId = req.user.sub;
    const contacto = await this.contactosService.crear(usuarioId, dto);
    return { contacto };
  }

  @Patch(':id')
  async actualizar(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarContactoDto,
  ) {
    const usuarioId = req.user.sub;
    const contacto = await this.contactosService.actualizar(id, usuarioId, dto);
    return { contacto };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const usuarioId = req.user.sub;
    await this.contactosService.eliminar(id, usuarioId);
  }
}