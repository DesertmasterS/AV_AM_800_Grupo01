import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WidgetSosPage } from './widget-sos.page';
import { ApiService } from '../../services/api';
import { AuthService } from '../../auth/auth.service';
import { WidgetService } from './widget.service';

describe('SOS desde widget', () => {
  const api = { obtenerAlertaActivaUsuario: vi.fn(), enviarAlerta: vi.fn() };
  let page: WidgetSosPage;
  beforeEach(() => {
    vi.clearAllMocks();
    api.obtenerAlertaActivaUsuario.mockReturnValue(of({ activa: null }));
    api.enviarAlerta.mockReturnValue(of({ id: 12 }));
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api }, { provide: AuthService, useValue: {} },
      { provide: WidgetService, useValue: { refrescar: vi.fn() } },
    ] });
    page = TestBed.runInInjectionContext(() => new WidgetSosPage());
  });
  it('consulta el estado sin enviar una alerta al abrir', async () => {
    await page.ionViewWillEnter();
    expect(page.active()).toBeNull();
    expect(api.enviarAlerta).not.toHaveBeenCalled();
  });
  it('conserva una sola alerta activa', async () => {
    api.obtenerAlertaActivaUsuario.mockReturnValue(of({ activa: { id: 5 } }));
    await page.ionViewWillEnter(); await page.enviar();
    expect(page.active()?.id).toBe(5);
    expect(api.enviarAlerta).not.toHaveBeenCalled();
  });
  it('envía únicamente al confirmar y captura las coordenadas actuales', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: -33, longitude: -70 } } as GeolocationPosition),
    } });
    await page.ionViewWillEnter(); await page.enviar();
    expect(api.enviarAlerta).toHaveBeenCalledWith(expect.objectContaining({ origen: 'BOTON', latitud: -33, longitud: -70 }));
    expect(page.active()?.id).toBe(12);
    Reflect.deleteProperty(navigator, 'geolocation');
  });
  it('no envía si se sale de la vista durante la captura de ubicación', async () => {
    let captured: PositionCallback | undefined;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (ok: PositionCallback) => { captured = ok; },
    } });
    await page.ionViewWillEnter();
    const sending = page.enviar();
    page.ionViewDidLeave();
    captured!({ coords: { latitude: -33, longitude: -70 } } as GeolocationPosition);
    await sending;
    expect(api.enviarAlerta).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'geolocation');
  });
  it('no confirma como enviada una solicitud fallida', async () => {
    api.enviarAlerta.mockReturnValue(throwError(() => new Error('offline')));
    await page.ionViewWillEnter(); await page.enviar();
    expect(page.error()).toBe(true); expect(page.active()).toBeNull(); expect(page.busy()).toBe(false);
  });
});
