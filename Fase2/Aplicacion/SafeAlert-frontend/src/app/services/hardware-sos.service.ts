import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from './api';

@Injectable({
  providedIn: 'root',
})
export class HardwareSosService {
  private readonly apiService = inject(ApiService);
  private readonly toastController = inject(ToastController);

  private contadorPulsaciones = 0;
  private temporizador: any = null;
  private readonly VENTANA_MS = 2000;
  private readonly PULSACIONES_OBJETIVO = 3;
  private enviando = false;

  inicializarListener(): void {
    // Simular en web o inyección de eventos en android
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'VolumeDown' || event.code === 'VolumeDown') {
        this.procesarPulsacion();
      }
    });
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
      this.ejecutarAlertaSos();
    }
  }

  private reiniciarContador(): void {
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    this.contadorPulsaciones = 0;
  }

  private ejecutarAlertaSos(): void {
    this.enviando = true;

    this.apiService.enviarAlerta({ notificarPolicia: true, origen: 'VOLUMEN' }).subscribe({
      next: async (res) => {
        this.enviando = false;
        await this.mostrarAviso(
          `¡S.O.S DISPARADO! Alerta #${res.id ?? res.alertaId} enviada`,
          'danger'
        );
      },
      error: async (err) => {
        this.enviando = false;
        console.error('Error enviando alerta SOS por hardware:', {
          status: err?.status,
          message: err?.message,
          error: err?.error,
        });
        await this.mostrarAviso(
          'Error al emitir alerta de emergencia',
          'warning'
        );
      },
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
}
