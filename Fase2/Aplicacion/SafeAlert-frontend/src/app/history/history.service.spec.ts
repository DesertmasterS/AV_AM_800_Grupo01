import { environment } from '../../environments/environment';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { HistoryService } from './history.service';
import { AlertaHistorial } from './history.models';

describe('HistoryService', () => {
  let service: HistoryService;
  let http: HttpTestingController;
  const url = environment.apiUrl + '/alerta/historial';
  const alerta: AlertaHistorial = {
    id: 10,
    tipo: 'EMERGENCIA_SOS',
    eventoId: 'evt-10',
    latitud: -33.4489,
    longitud: -70.6693,
    estado: 'ACTIVA',
    fecha: '2026-10-27T10:06:28.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HistoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta el historial con credenciales de sesión y normaliza la respuesta', () => {
    let resultado: AlertaHistorial[] = [];
    service.listar().subscribe((items) => {
      resultado = items;
    });

    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([alerta]);

    expect(resultado).toEqual([alerta]);
  });
});