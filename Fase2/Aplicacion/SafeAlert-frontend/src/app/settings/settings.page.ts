import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { AuthService } from '../auth/auth.service';
import { MotionSosService } from './movimiento/motion-sos.service';
import { VolumeSosService } from './volumen/volume-sos.service';

@Component({
  selector: 'app-settings', standalone: true,
  imports: [IonicModule, RouterLink],
  templateUrl: './settings.page.html', styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
  readonly auth = inject(AuthService);
  readonly motion = inject(MotionSosService);
  readonly volumen = inject(VolumeSosService);
  readonly consentimientoVolumen = signal(false);
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
  ionViewDidLeave() { this.limpiarTimer(); this.consentimiento.set(false); this.consentimientoVolumen.set(false); }
  private limpiarTimer() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  private async refrescar() {
    try { await Promise.all([this.motion.refrescar(), this.volumen.refrescar()]); }
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
  async activarVolumen() {
    if (this.ocupado() || !this.consentimientoVolumen()) return;
    await this.operar(async () => {
      await this.auth.prepararSesionSos();
      await this.volumen.activar();
    });
  }
  async detenerVolumen() { await this.operar(() => this.volumen.detener()); }
  async configurarVolumen() { await this.operar(() => this.volumen.configurarPermisos()); }
  async abrirAccesibilidad() { await this.operar(() => this.volumen.abrirAccesibilidad()); }
  async abrirPermisosVolumen() { await this.operar(() => this.volumen.abrirPermisosAndroid()); }
  private async operar(action: () => Promise<void>) {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    try { await action(); }
    catch (error: unknown) { this.error.set(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
    finally { this.ocupado.set(false); }
  }
}
