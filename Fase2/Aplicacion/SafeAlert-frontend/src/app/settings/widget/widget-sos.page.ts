import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { firstValueFrom, timeout, skip } from 'rxjs';
import { ApiService, AlertaRegistrada } from '../../services/api';
import { AuthService } from '../../auth/auth.service';
import { WidgetService } from './widget.service';

@Component({
  selector: 'app-widget-sos', standalone: true, imports: [IonicModule, RouterLink],
  templateUrl: './widget-sos.page.html', styleUrls: ['./widget-sos.page.scss'],
})
export class WidgetSosPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly widget = inject(WidgetService);
  constructor() {
    // Una segunda pulsación del widget debe consultar de nuevo aunque esta vista siga abierta.
    inject(ActivatedRoute, { optional: true })?.queryParamMap.pipe(skip(1), takeUntilDestroyed())
      .subscribe(() => { if (!this.busy()) void this.ionViewWillEnter(); });
  }
  private requestId = 0;
  ionViewDidLeave() { this.requestId++; }
  readonly busy = signal(false);
  readonly checking = signal(true);
  readonly active = signal<AlertaRegistrada | null>(null);
  readonly message = signal('');
  readonly error = signal(false);

  async ionViewWillEnter() {
    this.checking.set(true); this.message.set('');
    this.widget.refrescar();
    try {
      const response = await firstValueFrom(this.api.obtenerAlertaActivaUsuario().pipe(timeout(8000)));
      this.active.set(response.activa);
    } catch {
      this.active.set(null);
      this.message.set('No se pudo consultar el estado. Puedes intentar enviar el SOS; el servidor comprobará si ya tienes una alerta activa.');
    } finally { this.checking.set(false); }
  }
  async enviar() {
    if (this.busy() || this.checking() || this.active()) return;
    const requestId = ++this.requestId;
    this.busy.set(true); this.error.set(false); this.message.set('Buscando ubicación y preparando el SOS…');
    try {
      const coordinates = await this.ubicacion();
      if (requestId !== this.requestId) return;
      const alerta = await firstValueFrom(this.api.enviarAlerta({ ...coordinates, origen: 'BOTON', eventoId: crypto.randomUUID() }).pipe(timeout(15000)));
      this.active.set(alerta);
      this.message.set(alerta.yaActiva || alerta.duplicada ? 'Ya tienes una alerta activa. No se creó otra alerta.' : 'SOS registrado. Tu alerta está activa.');
    } catch {
      this.error.set(true);
      this.message.set('No se pudo confirmar el SOS. Revisa tu conexión y sesión antes de intentar nuevamente.');
    } finally { this.busy.set(false); this.widget.refrescar(); }
  }
  private ubicacion(): Promise<{ latitud?: number; longitud?: number }> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve({}); return; }
      navigator.geolocation.getCurrentPosition(
        position => resolve({ latitud: position.coords.latitude, longitud: position.coords.longitude }),
        () => resolve({}), { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    });
  }
}
