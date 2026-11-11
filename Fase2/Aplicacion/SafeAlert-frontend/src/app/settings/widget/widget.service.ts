import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

const bridge = registerPlugin<{ requestPin(): Promise<{ requested: boolean }>; refresh(): Promise<void> }>('SosWidget');
@Injectable({ providedIn: 'root' })
export class WidgetService {
  private readonly router = inject(Router, { optional: true });
  readonly disponible = Capacitor.getPlatform() === 'android';
  readonly mensaje = signal('');
  private initialized = false;

  async agregar(): Promise<void> {
    if (!this.disponible) return;
    const result = await bridge.requestPin();
    this.mensaje.set(result.requested
      ? 'Confirma «Agregar» en el diálogo de Android. También puedes añadirlo desde el selector de widgets de tu pantalla de inicio.'
      : 'Mantén presionado un espacio vacío en la pantalla de inicio, entra en Widgets y busca «SafeAlert · Emergencia».');
  }
  refrescar(): void {
    if (this.disponible) void bridge.refresh().catch(() => undefined);
  }
  async inicializar(): Promise<void> {
    if (!this.disponible || this.initialized) return;
    this.initialized = true;
    try {
      await App.addListener('appUrlOpen', event => this.abrir(event.url));
      const launch = await App.getLaunchUrl();
      if (launch?.url) this.abrir(launch.url);
    } catch { this.initialized = false; }
  }
  private abrir(url: string): void {
    if (url === 'safealert://widget/sos') void this.router?.navigateByUrl('/widget-sos?entrada=' + Date.now());
  }
}
