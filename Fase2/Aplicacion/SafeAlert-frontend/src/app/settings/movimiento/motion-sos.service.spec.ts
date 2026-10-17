import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { MOTION_IS_ANDROID, MOTION_SOS_BRIDGE, MotionSosService } from './motion-sos.service';

describe('MotionSosService', () => {
  const bridge = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), cancel: vi.fn().mockResolvedValue(undefined), getStatus: vi.fn() };
  function crear(android: boolean) {
    TestBed.configureTestingModule({ providers: [
      { provide: MOTION_IS_ANDROID, useValue: android }, { provide: MOTION_SOS_BRIDGE, useValue: bridge },
    ] });
    return TestBed.inject(MotionSosService);
  }
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.getStatus.mockResolvedValue({ active: true, phase: 'monitoring', deadline: 0, sessionEndsAt: 1, message: 'Activa' });
  });
  it('no ofrece una detección simulada desde el navegador', async () => {
    const service = crear(false);
    await expect(service.activar('token', 7)).rejects.toThrow('solo está disponible en Android');
    await service.detener();
    expect(bridge.start).not.toHaveBeenCalled();
    expect(bridge.stop).not.toHaveBeenCalled();
    expect(service.estado().active).toBe(false);
  });
  it('envía el contrato nativo y muestra únicamente el estado reportado por Android', async () => {
    const service = crear(true);
    await service.activar('token-de-prueba', 7);
    expect(bridge.start).toHaveBeenCalledWith({ token: 'token-de-prueba', usuarioId: '7', endpoint: environment.apiUrl + '/alerta' });
    expect(service.estado().active).toBe(true);
    await service.detener();
    expect(bridge.stop).toHaveBeenCalledOnce();
    expect(service.estado().active).toBe(false);
  });
  it('permite cancelar la prealerta sin enviar una alerta desde JavaScript', async () => {
    const service = crear(true);
    await service.cancelarPrealerta();
    expect(bridge.cancel).toHaveBeenCalledOnce();
    expect(bridge.start).not.toHaveBeenCalled();
  });
  it('propaga un permiso rechazado sin mostrar el monitoreo como activo', async () => {
    const service = crear(true);
    bridge.start.mockRejectedValueOnce(new Error('Permiso rechazado'));
    await expect(service.activar('token', 7)).rejects.toThrow('Permiso rechazado');
    expect(service.estado().active).toBe(false);
  });
});
