import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { environment } from '../../../environments/environment';

export interface MotionStatus {
  active: boolean;
  phase: 'inactive' | 'monitoring' | 'countdown' | 'sending' | 'retrying';
  deadline: number;
  sessionEndsAt: number;
  message: string;
}
export interface MotionSosBridge {
  start(options: { token: string; endpoint: string; usuarioId: string }): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  getStatus(): Promise<MotionStatus>;
}
export const MOTION_SOS_BRIDGE = new InjectionToken<MotionSosBridge>('MotionSosBridge', {
  providedIn: 'root', factory: () => {
    const plugin = registerPlugin<MotionSosBridge>('MotionSos');
    // No exponer el Proxy del plugin al inyector: Angular inspecciona ngOnDestroy.
    return {
      start: options => plugin.start(options), stop: () => plugin.stop(),
      cancel: () => plugin.cancel(), getStatus: () => plugin.getStatus(),
    };
  },
});
export const MOTION_IS_ANDROID = new InjectionToken<boolean>('MotionIsAndroid', {
  providedIn: 'root', factory: () => Capacitor.getPlatform() === 'android',
});
const inactive: MotionStatus = { active: false, phase: 'inactive', deadline: 0, sessionEndsAt: 0, message: '' };

@Injectable({ providedIn: 'root' })
export class MotionSosService {
  private readonly bridge = inject(MOTION_SOS_BRIDGE);
  readonly disponible = inject(MOTION_IS_ANDROID);
  readonly estado = signal<MotionStatus>(inactive);

  async refrescar() {
    if (this.disponible) this.estado.set(await this.bridge.getStatus());
  }
  async activar(token: string, usuarioId: number) {
    if (!this.disponible) throw new Error('La detección en segundo plano solo está disponible en Android.');
    if (!token || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new Error('Inicia sesión antes de activar la detección.');
    await this.bridge.start({ token, usuarioId: String(usuarioId), endpoint: environment.apiUrl + '/alerta' });
    await this.refrescar();
  }
  async detener() {
    if (this.disponible) await this.bridge.stop();
    this.estado.set(inactive);
  }
  async cancelarPrealerta() {
    if (this.disponible) { await this.bridge.cancel(); await this.refrescar(); }
  }
}
