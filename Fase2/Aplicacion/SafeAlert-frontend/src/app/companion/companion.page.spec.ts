import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanionPage } from './companion.page';
import { ApiService } from '../services/api';

describe('CompanionPage', () => {
  const queryParams$ = new BehaviorSubject(convertToParamMap({}));
  const api = {
    obtenerAlertaEnVivo: vi.fn(),
    enviarAlerta: vi.fn(),
    detenerTransmisionGps: vi.fn(),
  };
  const geolocation = { getCurrentPosition: vi.fn() };
  let page: CompanionPage;

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams$.next(convertToParamMap({}));
    vi.stubGlobal('navigator', { geolocation });
    vi.stubGlobal('L', {
      map: vi.fn(),
      tileLayer: vi.fn(),
      marker: vi.fn(),
      circle: vi.fn(),
    });

    api.obtenerAlertaEnVivo.mockReturnValue(
      of({
        id: 21,
        alertaId: 21,
        nombreUsuario: 'Persona Uno',
        tipo: 'EMERGENCIA_SOS',
        estado: 'ACTIVA',
        latitud: -33.4489,
        longitud: -70.6693,
        fecha: '2026-10-27T13:06:28.000Z',
      }),
    );
    api.enviarAlerta.mockReturnValue(of({ id: 35 }));

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams$.asObservable() } },
      ],
    });
    page = TestBed.runInInjectionContext(() => new CompanionPage());
  });

  afterEach(() => {
    page.ngOnDestroy();
    vi.unstubAllGlobals();
  });

  it('consulta la alerta en vivo al buscar un ID válido y rechaza IDs inválidos', () => {
    page.alertaIdBusqueda.set('');
    page.buscarAlertaManual();
    expect(api.obtenerAlertaEnVivo).not.toHaveBeenCalled();
    expect(page.error()).toContain('Ingresa un número');

    page.alertaIdBusqueda.set('21');
    page.buscarAlertaManual();
    expect(api.obtenerAlertaEnVivo).toHaveBeenCalledWith(21);
    expect(page.alertaActiva()?.nombreUsuario).toBe('Persona Uno');
  });

  it('inicia el trayecto en vivo y activa el seguimiento de la alerta creada', () => {
    geolocation.getCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: -33.45, longitude: -70.66 } }),
    );
    page.iniciarMiTrayecto();
    expect(api.enviarAlerta).toHaveBeenCalledWith(
      expect.objectContaining({ latitud: -33.45, longitud: -70.66, origen: 'BOTON' }),
    );
    expect(page.transmitiendo()).toBe(true);
    expect(api.obtenerAlertaEnVivo).toHaveBeenCalledWith(35);
  });

  it('permite explorar el ejemplo sin llamar al backend y detener la transmisión', () => {
    page.verEjemplo();
    expect(page.demo()).toBe(true);
    expect(page.alertaActiva()?.id).toBe(99);
    expect(api.enviarAlerta).not.toHaveBeenCalled();

    page.detenerMiTrayecto();
    expect(api.detenerTransmisionGps).toHaveBeenCalledOnce();
    expect(page.transmitiendo()).toBe(false);
  });

  it('informa cuando la sesión no está disponible (401) al compartir trayecto', () => {
    geolocation.getCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: -33.45, longitude: -70.66 } }),
    );
    api.enviarAlerta.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    page.iniciarMiTrayecto();
    expect(page.error()).toContain('Inicia sesión');
  });
});