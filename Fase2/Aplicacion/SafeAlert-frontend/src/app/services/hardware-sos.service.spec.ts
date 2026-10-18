import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { ApiService } from './api';
import { HardwareSosService } from './hardware-sos.service';
import { VOLUME_IS_ANDROID } from '../settings/volumen/volume-sos.service';

describe('HardwareSosService', () => {
  const api = { enviarAlerta: vi.fn() };
  const toast = { create: vi.fn() };
  const location = { getCurrentPosition: vi.fn() };
  function press(repeat = false) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'VolumeDown', repeat })); }
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('navigator', { geolocation: location });
    api.enviarAlerta.mockReturnValue(of({ id: 15 }));
    toast.create.mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) });
    TestBed.configureTestingModule({ providers: [
      { provide: ApiService, useValue: api }, { provide: ToastController, useValue: toast }, { provide: VOLUME_IS_ANDROID, useValue: false },
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
  it('envía las coordenadas obtenidas y evita instalar dos veces el listener', async () => {
    location.getCurrentPosition.mockImplementation(success => success({ coords: { latitude: -33.45, longitude: -70.66 } }));
    const service = TestBed.inject(HardwareSosService);
    service.inicializarListener(); service.inicializarListener();
    press(); press();
    expect(api.enviarAlerta).not.toHaveBeenCalled();
    press(); await Promise.resolve();
    expect(api.enviarAlerta).toHaveBeenCalledOnce();
    expect(api.enviarAlerta).toHaveBeenCalledWith(expect.objectContaining({ origen: 'VOLUMEN', latitud: -33.45, longitud: -70.66, notificarPolicia: false }));
  });
  it('continúa sin coordenadas si se rechaza la ubicación', async () => {
    location.getCurrentPosition.mockImplementation((_success, error) => error());
    TestBed.inject(HardwareSosService).inicializarListener();
    press(); press(); press(); await Promise.resolve();
    expect(api.enviarAlerta).toHaveBeenCalledWith(expect.not.objectContaining({ latitud: expect.anything() }));
    expect(api.enviarAlerta).toHaveBeenCalledOnce();
  });
  it('deja Android a cargo de una única ruta nativa', async () => {
    TestBed.overrideProvider(VOLUME_IS_ANDROID, { useValue: true });
    TestBed.inject(HardwareSosService).inicializarListener();
    press(); press(); press(); await Promise.resolve();
    expect(api.enviarAlerta).not.toHaveBeenCalled();
    expect(location.getCurrentPosition).not.toHaveBeenCalled();
  });
  it('ignora pulsaciones repetidas por mantener el botón presionado', () => {
    TestBed.inject(HardwareSosService).inicializarListener();
    press(); press(true); press(true);
    expect(location.getCurrentPosition).not.toHaveBeenCalled();
  });
});
