import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface VolumeStatus {
  active: boolean;
  phase: 'inactive' | 'monitoring' | 'locating' | 'sending';
  sessionEndsAt: number;
  accessibilityEnabled: boolean;
  accessibilityConnected: boolean;
  locationGranted: boolean;
  locationEnabled: boolean;
  notificationsGranted: boolean;
  gpsEnabled: boolean;
  message: string;
}
export interface VolumeSosBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<VolumeStatus>;
  configurePermissions(): Promise<void>;
  openAccessibilitySettings(): Promise<void>;
  openAppSettings(): Promise<void>;
}
export const VOLUME_IS_ANDROID = new InjectionToken<boolean>('VolumeIsAndroid', {
  providedIn: 'root', factory: () => Capacitor.getPlatform() === 'android',
});
export const VOLUME_SOS_BRIDGE = new InjectionToken<VolumeSosBridge>('VolumeSosBridge', {
  providedIn: 'root', factory: () => {
    const plugin = registerPlugin<VolumeSosBridge>('VolumeSos');
    return {
      start: () => plugin.start(), stop: () => plugin.stop(), getStatus: () => plugin.getStatus(),
      configurePermissions: () => plugin.configurePermissions(),
      openAccessibilitySettings: () => plugin.openAccessibilitySettings(), openAppSettings: () => plugin.openAppSettings(),
    };
  },
});
const inactive: VolumeStatus = {
  active: false, phase: 'inactive', sessionEndsAt: 0, accessibilityEnabled: false, accessibilityConnected: false,
  locationGranted: false, locationEnabled: false, notificationsGranted: false, gpsEnabled: false, message: '',
};

@Injectable({ providedIn: 'root' })
export class VolumeSosService {
  private readonly bridge = inject(VOLUME_SOS_BRIDGE);
  readonly disponible = inject(VOLUME_IS_ANDROID);
  readonly estado = signal<VolumeStatus>(inactive);
  readonly lista = computed(() => {
    const status = this.estado();
    return status.active && status.accessibilityEnabled && status.accessibilityConnected && status.notificationsGranted;
  });
  async refrescar() { if (this.disponible) this.estado.set(await this.bridge.getStatus()); }
  async activar() { this.exigirAndroid(); await this.bridge.start(); await this.refrescar(); }
  async detener() {
    if (this.disponible) { await this.bridge.stop(); await this.refrescar(); }
    else this.estado.set(inactive);
  }
  async configurarPermisos() { this.exigirAndroid(); await this.bridge.configurePermissions(); await this.refrescar(); }
  async abrirAccesibilidad() { this.exigirAndroid(); await this.bridge.openAccessibilitySettings(); }
  async abrirPermisosAndroid() { this.exigirAndroid(); await this.bridge.openAppSettings(); }
  private exigirAndroid() {
    if (!this.disponible) throw new Error('La protección con botones de volumen requiere la app instalada en Android.');
  }
}
