import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VOLUME_IS_ANDROID, VOLUME_SOS_BRIDGE, VolumeSosService, VolumeStatus } from './volume-sos.service';

describe('VolumeSosService', () => {
  const state: VolumeStatus = {
    active: false, phase: 'inactive', sessionEndsAt: 0, accessibilityEnabled: false, accessibilityConnected: false,
    locationGranted: false, locationEnabled: false, notificationsGranted: false, gpsEnabled: false, message: '',
  };
  const bridge = {
    start: vi.fn(), stop: vi.fn(), getStatus: vi.fn(), configurePermissions: vi.fn(), openAccessibilitySettings: vi.fn(), openAppSettings: vi.fn(),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    bridge.getStatus.mockResolvedValue({ ...state });
    TestBed.configureTestingModule({ providers: [
      { provide: VOLUME_IS_ANDROID, useValue: true }, { provide: VOLUME_SOS_BRIDGE, useValue: bridge },
    ] });
  });
  it('no declara una sesión activa hasta que el servicio nativo la confirma', async () => {
    const service = TestBed.inject(VolumeSosService);
    await service.activar();
    expect(bridge.start).toHaveBeenCalledOnce();
    expect(service.estado().active).toBe(false);
    bridge.getStatus.mockResolvedValue({ ...state, active: true, phase: 'monitoring', accessibilityEnabled: true, accessibilityConnected: true, notificationsGranted: true });
    await service.refrescar();
    expect(service.lista()).toBe(true);
  });
  it('no considera lista una sesión si se pierde accesibilidad', async () => {
    bridge.getStatus.mockResolvedValue({ ...state, active: true, accessibilityEnabled: true, accessibilityConnected: false, notificationsGranted: true });
    const service = TestBed.inject(VolumeSosService);
    await service.refrescar();
    expect(service.lista()).toBe(false);
  });
  it('solicita permisos y abre ajustes sin simular que fueron concedidos', async () => {
    const service = TestBed.inject(VolumeSosService);
    await service.configurarPermisos();
    await service.abrirAccesibilidad();
    await service.abrirPermisosAndroid();
    expect(bridge.configurePermissions).toHaveBeenCalledOnce();
    expect(bridge.openAccessibilitySettings).toHaveBeenCalledOnce();
    expect(bridge.openAppSettings).toHaveBeenCalledOnce();
    expect(service.estado().locationGranted).toBe(false);
  });
  it('no permite habilitar botones desde un navegador', async () => {
    TestBed.overrideProvider(VOLUME_IS_ANDROID, { useValue: false });
    const service = TestBed.inject(VolumeSosService);
    await expect(service.activar()).rejects.toThrow('Android');
    expect(bridge.start).not.toHaveBeenCalled();
  });
  it('conserva el rechazo nativo y permite detener la sesión', async () => {
    bridge.start.mockRejectedValue(new Error('Habilita Accesibilidad'));
    const service = TestBed.inject(VolumeSosService);
    await expect(service.activar()).rejects.toThrow('Accesibilidad');
    await service.detener();
    expect(bridge.stop).toHaveBeenCalledOnce();
  });
});
