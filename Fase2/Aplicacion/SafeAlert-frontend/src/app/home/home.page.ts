import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastController } from '@ionic/angular';
import { finalize, timeout } from 'rxjs';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-home', templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'], standalone: false,
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

  ngOnInit() { this.verificarConexion(); }

  verificarConexion() {
    this.conexion = 'checking';
    this.changeDetector.markForCheck();
    this.apiService.probarConexion().pipe(timeout(8000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.conexion = 'online'; this.changeDetector.markForCheck(); },
      error: () => { this.conexion = 'offline'; this.changeDetector.markForCheck(); },
    });
  }

  activarAlerta() {
    if (this.enviando) return;
    this.enviando = true;
    this.resultado = '';
    this.errorAlerta = false;
    this.changeDetector.markForCheck();
    this.apiService.enviarAlerta().pipe(
      timeout(15000),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { this.enviando = false; this.changeDetector.markForCheck(); }),
    ).subscribe({
      next: (alerta) => {
        this.conexion = 'online';
        this.resultado = `Alerta #${alerta.id} registrada. El envío a contactos aún no está disponible.`;
        this.changeDetector.markForCheck();
        void this.mostrarNotificacion(this.resultado, 'success');
      },
      error: () => {
        this.errorAlerta = true;
        this.resultado = 'No se pudo confirmar el registro de la alerta. Revisa tu conexión e inténtalo nuevamente.';
        this.changeDetector.markForCheck();
        void this.mostrarNotificacion(this.resultado, 'danger');
      },
    });
  }

  private async mostrarNotificacion(message: string, color: string) {
    const toast = await this.toastController.create({ message, color, duration: 5000, position: 'top' });
    await toast.present();
  }
}
