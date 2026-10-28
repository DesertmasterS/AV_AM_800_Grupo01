import { DestroyRef, Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from './api';
import { finalize, timeout } from 'rxjs';
import { VOLUME_IS_ANDROID } from '../settings/volumen/volume-sos.service';

@Injectable({
  providedIn: 'root',
})
export class HardwareSosService {
  private readonly apiService = inject(ApiService);
  private readonly toastController = inject(ToastController);
  private readonly android = inject(VOLUME_IS_ANDROID);
  private inicializado = false;
  private readonly listener = (event: KeyboardEvent) => {
    if (!event.repeat && (event.key === 'VolumeDown' || event.code === 'VolumeDown')) this.procesarPulsacion();
  };

  private contadorPulsaciones = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private readonly VENTANA_MS = 2000;
  private readonly PULSACIONES_OBJETIVO = 3;
  private enviando = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('keydown', this.listener);
      this.reiniciarContador();
    });
  }

  inicializarListener(): void {
    // Android utiliza una sola ruta nativa para actividad y accesibilidad.
    if (this.android || this.inicializado) return;
    this.inicializado = true;
    window.addEventListener('keydown', this.listener);
  }

  private procesarPulsacion(): void {
    if (this.enviando) return; // Evita procesar si ya se está enviando una alerta

    this.contadorPulsaciones++;

    // Primer toque: arranca la ventana de 2 segundos
    if (this.contadorPulsaciones === 1) {
      this.temporizador = setTimeout(() => {
        this.reiniciarContador();
      }, this.VENTANA_MS);
    }

    // Tercer toque dentro de la ventana: dispara la alerta
    if (this.contadorPulsaciones >= this.PULSACIONES_OBJETIVO) {
      this.reiniciarContador();
      void this.ejecutarAlertaSos();
    }
  }

  private reiniciarContador(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.contadorPulsaciones = 0;
  }

  private async ejecutarAlertaSos(): Promise<void> {
    this.enviando = true;
    const coords = await this.obtenerUbicacion();
    this.apiService
      .enviarAlerta({
        ...coords,
        notificarPolicia: false,
        origen: 'VOLUMEN',
        eventoId: crypto.randomUUID(),
      })
      .pipe(
        timeout(15000),
        finalize(() => {
          this.enviando = false;
        }),
      )
      .subscribe({
        next: async (res: any) => {
          const id = res.id ?? res.alertaId;
          if (res.yaActiva || res.duplicada) {
            await this.mostrarAvisoConAccionDetener(id);
          } else {
            await this.mostrarAviso(
              `Alerta #${id} registrada${coords ? ' con ubicación del dispositivo.' : ' sin ubicación disponible.'}`,
              'danger',
            );
          }
        },
        error: async (err) => {
          console.error('Error enviando alerta SOS por hardware:', {
            status: err?.status,
            message: err?.message,
            error: err?.error,
          });
          await this.mostrarAviso('Error al emitir alerta de emergencia', 'warning');
        },
      });
  }

  private obtenerUbicacion(): Promise<{ latitud: number; longitud: number } | undefined> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(undefined); return; }
      try {
        navigator.geolocation.getCurrentPosition(
          position => resolve({ latitud: position.coords.latitude, longitud: position.coords.longitude }),
          () => resolve(undefined), { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
        );
      } catch { resolve(undefined); }
    });
  }

  private async mostrarAviso(mensaje: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3500,
      position: 'top',
      color,
    });
    await toast.present();
  }
  private async mostrarAvisoConAccionDetener(alertaId: number): Promise<void> {
    const toast = await this.toastController.create({
      message: `Ya tienes la Alerta #${alertaId} activa. ¿Deseas detenerla?`,
      duration: 6000,
      position: 'top',
      color: 'warning',
      buttons: [
        {
          text: 'Detener alerta',
          role: 'confirm',
          handler: () => {
            if ('detenerAlerta' in this.apiService) {
              this.apiService.detenerAlerta(alertaId).subscribe({
                next: () => {
                  void this.mostrarAviso(`Alerta #${alertaId} detenida y finalizada.`, 'success');
                },
              });
            }
          },
        },
        {
          text: 'Seguir activo',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }
}
