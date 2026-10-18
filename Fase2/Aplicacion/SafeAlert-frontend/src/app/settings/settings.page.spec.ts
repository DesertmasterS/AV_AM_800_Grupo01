import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { SettingsPage } from './settings.page';
import { MOTION_IS_ANDROID } from './movimiento/motion-sos.service';
import { VOLUME_IS_ANDROID, VOLUME_SOS_BRIDGE, VolumeSosService } from './volumen/volume-sos.service';

describe('SettingsPage: protección por volumen', () => {
  const nativeState = {
    active: false, phase: 'inactive' as const, sessionEndsAt: 0, accessibilityEnabled: true, accessibilityConnected: true,
    locationGranted: true, locationEnabled: false, notificationsGranted: true, gpsEnabled: true, message: '',
  };
  const bridge = { start: vi.fn(), stop: vi.fn(), getStatus: vi.fn(), configurePermissions: vi.fn(), openAccessibilitySettings: vi.fn(), openAppSettings: vi.fn() };
  const auth = {
    usuario: signal({ id: 7 }), verificando: signal(false), errorSesion: signal(''),
    actualizarSesion: vi.fn(), prepararSesionSos: vi.fn(),
  };
  beforeEach(async () => {
    addIcons(icons);
    vi.resetAllMocks();
    bridge.getStatus.mockResolvedValue(nativeState);
    auth.prepararSesionSos.mockResolvedValue({ token: 'test-token', usuarioId: 7 });
    await TestBed.configureTestingModule({ imports: [SettingsPage], providers: [
      provideRouter([]), { provide: AuthService, useValue: auth },
      { provide: MOTION_IS_ANDROID, useValue: false }, { provide: VOLUME_IS_ANDROID, useValue: true }, { provide: VOLUME_SOS_BRIDGE, useValue: bridge },
    ] }).compileComponents();
  });
  it('requiere consentimiento y muestra accesos para configurar permisos', async () => {
    const fixture = TestBed.createComponent(SettingsPage);
    const service = TestBed.inject(VolumeSosService);
    service.estado.set(nativeState);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.volume-card') as HTMLElement;
    const activate = card.querySelector('.activate') as HTMLButtonElement;
    expect(activate.disabled).toBe(true);
    expect(card.textContent).toContain('Abrir Accesibilidad de Android');
    await fixture.componentInstance.activarVolumen();
    expect(bridge.start).not.toHaveBeenCalled();
    fixture.componentInstance.consentimientoVolumen.set(true);
    fixture.detectChanges();
    expect(activate.disabled).toBe(false);
    await fixture.componentInstance.activarVolumen();
    expect(auth.prepararSesionSos).toHaveBeenCalledOnce();
    expect(bridge.start).toHaveBeenCalledOnce();
  });
  it('bloquea la activación cuando el servicio de accesibilidad no está conectado', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    TestBed.inject(VolumeSosService).estado.set({ ...nativeState, accessibilityConnected: false });
    fixture.componentInstance.consentimientoVolumen.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.volume-card .activate').disabled).toBe(true);
  });
});
