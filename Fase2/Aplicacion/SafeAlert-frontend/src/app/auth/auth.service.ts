import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, tap, timeout } from 'rxjs';
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
    return this.http.post<SesionResponse>(this.url + '/login', datos, this.options)
      .pipe(timeout(15000), tap(res => this.currentUser.set(res.usuario)));
  }
  registrar(datos: RegistroRequest) {
    return this.http.post<SesionResponse>(this.url + '/register', datos, this.options)
      .pipe(timeout(15000), tap(res => this.currentUser.set(res.usuario)));
  }
  actualizarSesion() {
    if (this.verificando()) return;
    this.verificando.set(true);
    this.errorSesion.set('');
    this.http.get<SesionResponse>(this.url + '/me', this.options).pipe(
      timeout(10000),
      tap(res => this.currentUser.set(res.usuario)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.currentUser.set(null);
        } else {
          this.errorSesion.set('No se pudo verificar la sesión. El servicio de cuentas puede no estar disponible todavía.');
        }
        return of(null);
      }),
      finalize(() => this.verificando.set(false)),
    ).subscribe();
  }
  cerrarSesion() {
    return this.http.post<void>(this.url + '/logout', {}, this.options)
      .pipe(timeout(15000), tap(() => this.currentUser.set(null)));
  }
}
