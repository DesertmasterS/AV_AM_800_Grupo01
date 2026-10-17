import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, tap, timeout } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';
import { LoginRequest, RegistroRequest, SesionResponse, UsuarioSesion } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/auth';
  private readonly currentUser = signal<UsuarioSesion | null>(null);
  readonly usuario = this.currentUser.asReadonly();
  readonly verificando = signal(false);
  readonly errorSesion = signal('');
  private readonly options = { withCredentials: true };

  iniciarSesion(datos: LoginRequest) {
    return this.http.post<SesionResponse>(this.url + '/login', datos, this.options).pipe(
      timeout(15000),
      tap(res => {
        this.currentUser.set(res.usuario);
        this.sincronizarSosNativo(res);
      })
    );
  }

  registrar(datos: RegistroRequest) {
    return this.http.post<SesionResponse>(this.url + '/register', datos, this.options).pipe(
      timeout(15000),
      tap(res => {
        this.currentUser.set(res.usuario);
        this.sincronizarSosNativo(res);
      })
    );
  }

  actualizarSesion() {
    if (this.verificando()) return;
    this.verificando.set(true);
    this.errorSesion.set('');
    this.http.get<SesionResponse>(this.url + '/me', this.options).pipe(
      timeout(10000),
      tap(res => {
        this.currentUser.set(res.usuario);
        this.sincronizarSosNativo(res);
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.currentUser.set(null);
          this.limpiarSosNativo();
        } else {
          this.errorSesion.set('No se pudo verificar la sesión. El servicio de cuentas puede no estar disponible todavía.');
        }
        return of(null);
      }),
      finalize(() => this.verificando.set(false)),
    ).subscribe();
  }

  cerrarSesion() {
    return this.http.post<void>(this.url + '/logout', {}, this.options).pipe(
      timeout(15000),
      tap(() => {
        this.currentUser.set(null);
        this.limpiarSosNativo();
      })
    );
  }

  // --- Sincronización con el Servicio de Accesibilidad de Android ---
private async sincronizarSosNativo(res: SesionResponse) {
    if (res.token) {
      await Preferences.set({ key: 'jwt_token', value: res.token });
    }
    await Preferences.set({
      key: 'sos_endpoint',
      value: `${environment.apiUrl}/alerta`, 
    });
  }

  private async limpiarSosNativo() {
    await Preferences.remove({ key: 'jwt_token' });
    await Preferences.remove({ key: 'usuario_id' });
  }
}
