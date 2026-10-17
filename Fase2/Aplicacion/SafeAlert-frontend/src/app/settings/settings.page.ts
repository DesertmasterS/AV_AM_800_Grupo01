import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { AuthService } from '../auth/auth.service';
import { MotionSosService } from './movimiento/motion-sos.service';

@Component({
  selector: 'app-settings', standalone: true,
  imports: [IonicModule, RouterLink],
  templateUrl: './settings.page.html', styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
  readonly auth = inject(AuthService);
  readonly motion = inject(MotionSosService);
  readonly consentimiento = signal(false);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly ahora = signal(Date.now());
  readonly segundos = computed(() => Math.max(0, Math.ceil((this.motion.estado().deadline - this.ahora()) / 1000)));
  private timer?: ReturnType<typeof setInterval>;
  constructor() { inject(DestroyRef).onDestroy(() => this.limpiarTimer()); }
  ionViewWillEnter() {
    this.auth.actualizarSesion();
    void this.refrescar();
    this.limpiarTimer();
    this.timer = setInterval(() => { this.ahora.set(Date.now()); void this.refrescar(); }, 1000);
  }
  ionViewDidLeave() { this.limpiarTimer(); this.consentimiento.set(false); }
  private limpiarTimer() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  private async refrescar() {
    try { await this.motion.refrescar(); }
    catch { this.error.set('No se pudo consultar el servicio nativo. Revisa la instalación de Android.'); }
  }
  async activar() {
    if (this.ocupado() || !this.consentimiento()) return;
    await this.operar(async () => {
      const sesion = await this.auth.prepararSesionMovimiento();
      await this.motion.activar(sesion.token, sesion.usuarioId);
    });
  }
  async detener() { await this.operar(() => this.motion.detener()); }
  async cancelar() { await this.operar(() => this.motion.cancelarPrealerta()); }
  private async operar(action: () => Promise<void>) {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    try { await action(); }
    catch (error: unknown) { this.error.set(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
    finally { this.ocupado.set(false); }
  }
}
