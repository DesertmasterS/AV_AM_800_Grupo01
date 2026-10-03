import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('registra una alerta usando el contrato actual del backend', () => {
    let id: number | undefined;
    service.enviarAlerta().subscribe(alerta => { id = alerta.id; });
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('http://localhost:3000/alerta');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ id: 7 });
    expect(id).toBe(7);
    http.verify();
  });
});
