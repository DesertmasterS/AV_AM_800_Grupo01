import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('alerta')
  async registrarAlerta(
    @Body()
    body: {
      latitud?: number;
      longitud?: number;
      notificarPolicia?: boolean;
    },
  ) {
    const lat = body.latitud ?? -33.4372;
    const lon = body.longitud ?? -70.6506;
    const notificarPolicia = body.notificarPolicia ?? false;

    return await this.appService.crearAlerta(lat, lon, notificarPolicia);
  }
}