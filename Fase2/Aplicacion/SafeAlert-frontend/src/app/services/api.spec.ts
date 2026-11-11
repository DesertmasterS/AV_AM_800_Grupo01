import { environment } from '../../environments/environment';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BatteryService } from './battery.service';
import { ApiService } from './api';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: BatteryService, useValue: { readPercentage: async () => 37 } }] });
    service = TestBed.inject(ApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('registra una alerta usando el contrato actual del backend', async () => {
    let id: number | undefined;
    service.enviarAlerta().subscribe(alerta => { id = alerta.id; });
    await Promise.resolve();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(environment.apiUrl + '/alerta');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ bateriaPorcentaje: 37 });
    request.flush({ id: 7 });
    expect(id).toBe(7);
    http.verify();
  });
});
