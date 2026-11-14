import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { configureHttpSecurity } from '../src/security/http/http-security';

// La ruta de salud no necesita conectarse a la base de producción ni cargar credenciales reales.
describe('AppController HTTP (sin base de producción)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({ controllers: [AppController], providers: [AppService] }).compile();
    app = moduleFixture.createNestApplication();
    configureHttpSecurity(app);
    await app.init();
  });
  afterEach(async () => { await app.close(); });
  it('responde con el estado actual de la API', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('SafeAlert API Online');
  });
  it('aplica cabeceras de seguridad a la respuesta pública', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('conserva las cabeceras de seguridad en errores HTTP', async () => {
    const response = await request(app.getHttpServer()).get('/ruta-inexistente').expect(404);
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
