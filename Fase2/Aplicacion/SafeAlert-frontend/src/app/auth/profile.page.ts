import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { finalize } from 'rxjs';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-profile', standalone: true,
  imports: [IonicModule, RouterLink],
  templateUrl: './profile.page.html', styleUrls: ['./profile.page.scss'],
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly cerrando = signal(false);
  readonly error = signal('');
  ionViewWillEnter() { this.auth.actualizarSesion(); }
  cerrarSesion() {
    if (this.cerrando()) return;
    this.cerrando.set(true);
    this.error.set('');
    this.auth.cerrarSesion().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.cerrando.set(false))).subscribe({
      error: () => this.error.set('No se pudo cerrar la sesión. Vuelve a intentarlo.'),
    });
  }
}
