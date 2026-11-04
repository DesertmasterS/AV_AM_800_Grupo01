import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastController } from '@ionic/angular';
import { TimeoutError, finalize, timeout } from 'rxjs';
import { AlertaRegistrada, ApiService } from '../services/api';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly apiService = inject(ApiService);
  private readonly toastController = inject(ToastController);

  conexion: 'checking' | 'online' | 'offline' = 'checking';
  enviando = false;
  deteniendo = false;
  resultado = '';
  errorAlerta = false;
  alertaActiva: AlertaRegistrada | null = null;

  private syncInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.verificarConexion();
    this.consultarAlertaActiva();

    // Escuchar alertas disparadas por HardwareSosService o detenidas en otra vista
    if ('cambiosAlerta$' in this.apiService && this.apiService.cambiosAlerta$) {
      this.apiService.cambiosAlerta$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.consultarAlertaActiva();
        });
    }
  }

  ionViewWillEnter() {
    this.consultarAlertaActiva();
    this.iniciarSincronizacionActiva();
  }

  ionViewDidLeave() {
    this.detenerSincronizacionActiva();
  }

  ngOnDestroy() {
    this.detenerSincronizacionActiva();
  }

  private iniciarSincronizacionActiva() {
    this.detenerSincronizacionActiva();
    // Sincroniza cada 3 segundos por si se disparó/detuvo una alerta nativa (Volumen o Movimiento en Android)
    this.syncInterval = setInterval(() => {
      if (!this.enviando && !this.deteniendo) {
        this.consultarAlertaActiva();
      }
    }, 3000);
  }

  private detenerSincronizacionActiva() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  consultarAlertaActiva() {
    if (!('obtenerAlertaActivaUsuario' in this.apiService)) return;
    this.apiService
      .obtenerAlertaActivaUsuario()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const nuevaActiva = res?.activa ?? null;
          const idAnterior = this.alertaActiva?.id ?? null;
          const idNuevo = nuevaActiva?.id ?? null;

          this.alertaActiva = nuevaActiva;

          // Si apareció una alerta nueva desde Volumen o Movimiento mientras estábamos en Home
          if (idNuevo && idNuevo !== idAnterior) {
            this.resultado = `Alerta #${idNuevo} activa en curso.`;
            this.errorAlerta = false;
          } else if (!idNuevo && idAnterior) {
            // Si fue detenida desde la notificación de Android
            this.resultado = `Alerta #${idAnterior} detenida y marcada como FINALIZADA.`;
            this.errorAlerta = false;
          }

          this.changeDetector.markForCheck();
        },
        error: () => {
          this.alertaActiva = null;
          this.changeDetector.markForCheck();
        },
      });
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

    if (this.alertaActiva) {
      this.resultado = `Ya tienes la Alerta #${this.alertaActiva.id} activa. Usa el botón de abajo si deseas detenerla.`;
      this.errorAlerta = false;
      this.changeDetector.markForCheck();
      void this.mostrarNotificacion(this.resultado, 'warning');
      return;
    }

    this.enviando = true;
    this.resultado = '';
    this.errorAlerta = false;
    this.changeDetector.markForCheck();

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.procesarEnvioAlerta({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          });
        },
        () => {
          this.procesarEnvioAlerta();
        },
        { enableHighAccuracy: true, timeout: 5000 },
      );
    } else {
      this.procesarEnvioAlerta();
    }
  }

  confirmarDetenerAlerta() {
    if (!this.alertaActiva || this.deteniendo) return;
    const id = this.alertaActiva.id;
    this.deteniendo = true;
    this.changeDetector.markForCheck();

    this.apiService
      .detenerAlerta(id)
      .pipe(
        timeout(10000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.deteniendo = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.alertaActiva = null;
          this.errorAlerta = false;
          this.resultado = `Alerta #${id} detenida y marcada como FINALIZADA.`;
          this.changeDetector.markForCheck();
          void this.mostrarNotificacion(this.resultado, 'success');
        },
        error: () => {
          this.errorAlerta = true;
          this.resultado = 'No se pudo detener la alerta. Revisa tu conexión e inténtalo nuevamente.';
          this.changeDetector.markForCheck();
          void this.mostrarNotificacion(this.resultado, 'danger');
        },
      });
  }

  private procesarEnvioAlerta(coords?: { latitud: number; longitud: number }) {
    this.apiService
      .enviarAlerta({
        ...(coords ?? {}),
        origen: 'BOTON',
        eventoId:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : undefined,
      })
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
          this.alertaActiva = alerta;

          if (alerta.yaActiva || alerta.duplicada) {
            this.resultado = `Ya tienes la Alerta #${alerta.id} activa en este momento. ¿Deseas detenerla?`;
            this.changeDetector.markForCheck();
            void this.mostrarNotificacion(this.resultado, 'warning');
            return;
          }

          if (alerta.cuartelAsignado && alerta.cuartelAsignado !== 'Sin cuartel asignado') {
            this.resultado = `Alerta #${alerta.id} emitida. Cuartel asignado: ${alerta.cuartelAsignado} (a ${alerta.distanciaKm} km).`;
          } else {
            this.resultado = `Alerta #${alerta.id} registrada con éxito.`;
          }

          this.changeDetector.markForCheck();
          void this.mostrarNotificacion(this.resultado, 'success');
        },
        error: (error: unknown) => {
          this.errorAlerta = true;
          this.resultado = this.mensajeErrorAlerta(error);
          this.changeDetector.markForCheck();
          void this.mostrarNotificacion(this.resultado, 'danger');
        },
      });
  }

  private mensajeErrorAlerta(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'El servidor tardó demasiado en responder. No se pudo confirmar el registro de la alerta.';
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Tu sesión no es válida o ha vencido. Inicia sesión nuevamente para enviar la alerta.';
      if (error.status === 403) return 'Tu cuenta no tiene permiso para enviar esta alerta.';
      if (error.status === 429) return 'El servicio recibió demasiadas solicitudes. Espera unos segundos antes de volver a intentarlo.';
      if (error.status >= 500) return 'El servidor tuvo un problema al registrar la alerta. No se pudo confirmar el registro; esto no indica un fallo de tu conexión.';
      if (error.status >= 400) return 'El servidor rechazó la solicitud de alerta. No se pudo confirmar su registro.';
    }
    return 'No se pudo confirmar el registro de la alerta. Comprueba el acceso a internet y la disponibilidad del servicio.';
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