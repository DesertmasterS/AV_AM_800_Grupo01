import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { CompanionPage } from './companion.page';
import { ApiService } from '../services/api';

describe('CompanionPage', () => {
  let component: CompanionPage;
  let fixture: ComponentFixture<CompanionPage>;

  const queryParams$ = new BehaviorSubject(convertToParamMap({}));
  const apiMock = {
    obtenerAlertaEnVivo: vi.fn(),
    enviarAlerta: vi.fn(),
    detenerTransmisionGps: vi.fn(),
  };
  const geolocationMock = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    queryParams$.next(convertToParamMap({}));

    vi.stubGlobal('navigator', { geolocation: geolocationMock });
    vi.stubGlobal('L', {
      map: vi.fn().mockReturnValue({
        setView: vi.fn().mockReturnThis(),
        panTo: vi.fn(),
        remove: vi.fn(),
      }),
      tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
      marker: vi.fn().mockReturnValue({
        addTo: vi.fn().mockReturnValue({
          bindPopup: vi.fn().mockReturnValue({ openPopup: vi.fn() }),
          setLatLng: vi.fn().mockReturnThis(),
          setPopupContent: vi.fn(),
        }),
      }),
      circle: vi.fn().mockReturnValue({
        addTo: vi.fn().mockReturnValue({ setLatLng: vi.fn() }),
      }),
    });

    apiMock.obtenerAlertaEnVivo.mockReturnValue(
      of({
        id: 21,
        alertaId: 21,
        nombreUsuario: 'Camila',
        tipo: 'EMERGENCIA_SOS',
        estado: 'ACTIVA',
        latitud: -33.4489,
        longitud: -70.6693,
        fecha: new Date().toISOString(),
      }),
    );
    apiMock.enviarAlerta.mockReturnValue(of({ id: 35 }));

    await TestBed.configureTestingModule({
      imports: [CompanionPage],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiMock },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams$.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanionPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('consulta automáticamente la alerta en vivo cuando llega alertaId en la URL de WhatsApp', async () => {
    queryParams$.next(convertToParamMap({ alertaId: '21' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiMock.obtenerAlertaEnVivo).toHaveBeenCalledWith(21);
    expect(component.alertaActiva?.nombreUsuario).toBe('Camila');
  });

  it('permite iniciar un trayecto en vivo y activar el monitoreo propio', () => {
    geolocationMock.getCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: -33.45, longitude: -70.66 } }),
    );

    fixture.detectChanges();
    component.iniciarMiTrayectoEnVivo();

    expect(apiMock.enviarAlerta).toHaveBeenCalledWith(
      expect.objectContaining({
        latitud: -33.45,
        longitud: -70.66,
        origen: 'BOTON',
      }),
    );
    expect(component.transmitiendoLocal).toBe(true);
    expect(apiMock.obtenerAlertaEnVivo).toHaveBeenCalledWith(35);
  });
});