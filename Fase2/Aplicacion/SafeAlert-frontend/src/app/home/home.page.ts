import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastController } from '@ionic/angular';
import { finalize, timeout } from 'rxjs';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly apiService = inject(ApiService);
  private readonly toastController = inject(ToastController);

  conexion: 'checking' | 'online' | 'offline' = 'checking';
  enviando = false;
  resultado = '';
  errorAlerta = false;

  ngOnInit() {
    this.verificarConexion();
  }

  verificarConexion() {
    this.conexion = 'checking';
    this.changeDetector.markForCheck();
    this.apiService
      .probarConexion()
      .pipe(timeout(8000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.conexion = 'online';
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.conexion = 'offline';
          this.changeDetector.markForCheck();
        },
      });
  }

  activarAlerta() {
    if (this.enviando) return;
    this.enviando = true;
    this.resultado = '';
    this.errorAlerta = false;
    this.changeDetector.markForCheck();

    // Intentar obtener geolocalización del dispositivo
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.procesarEnvioAlerta({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          });
        },
        () => {
          // Si el usuario rechaza el permiso o falla el GPS, envía sin coordenadas (el backend usa fallback)
          this.procesarEnvioAlerta();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      this.procesarEnvioAlerta();
    }
  }

  private procesarEnvioAlerta(coords?: { latitud: number; longitud: number }) {
    this.apiService
      .enviarAlerta(coords)
      .pipe(
        timeout(15000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.enviando = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (alerta: any) => {
          this.conexion = 'online';

          // Mensaje enriquecido con el cuartel asignado
          if (alerta.cuartelAsignado && alerta.cuartelAsignado !== 'Sin cuartel asignado') {
            this.resultado = `Alerta #${alerta.id} emitida. Cuartel asignado: ${alerta.cuartelAsignado} (a ${alerta.distanciaKm} km).`;
          } else {
            this.resultado = `Alerta #${alerta.id} registrada en Neon con éxito.`;
          }

          this.changeDetector.markForCheck();
          void this.mostrarNotificacion(this.resultado, 'success');
        },
        error: () => {
          this.errorAlerta = true;
          this.resultado =
            'No se pudo confirmar el registro de la alerta. Revisa tu conexión e inténtalo nuevamente.';
          this.changeDetector.markForCheck();
          void this.mostrarNotificacion(this.resultado, 'danger');
        },
      });
  }

  private async mostrarNotificacion(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 5000,
      position: 'top',
    });
    await toast.present();
  }
}