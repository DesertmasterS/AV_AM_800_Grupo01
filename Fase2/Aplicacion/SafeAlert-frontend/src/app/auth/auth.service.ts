import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, tap, timeout } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';
import { LoginRequest, RegistroRequest, SesionResponse, UsuarioSesion } from './auth.models';
import { MotionSosService } from '../settings/movimiento/motion-sos.service';
import { VolumeSosService } from '../settings/volumen/volume-sos.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly movimiento = inject(MotionSosService);
  private readonly volumen = inject(VolumeSosService);
  private nativeToken: string | null = null;
  private sincronizacionNativa: Promise<void> = Promise.resolve();
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
        this.prepararSosNativo(res);
      })
    );
  }

  registrar(datos: RegistroRequest) {
    return this.http.post<SesionResponse>(this.url + '/register', datos, this.options).pipe(
      timeout(15000),
      tap(res => {
        this.currentUser.set(res.usuario);
        this.prepararSosNativo(res);
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
        this.prepararSosNativo(res);
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.currentUser.set(null);
          void this.limpiarSosNativo();
        } else {
          this.errorSesion.set('No se pudo verificar la sesión. El servicio de cuentas puede no estar disponible todavía.');
        }
        return of(null);
      }),
      finalize(() => this.verificando.set(false)),
    ).subscribe();
  }

  cerrarSesion() {
    void this.movimiento.detener().catch(() => undefined);
    void this.volumen.detener().catch(() => undefined);
    return this.http.post<void>(this.url + '/logout', {}, this.options).pipe(
      timeout(15000),
      tap(() => {
        this.currentUser.set(null);
        void this.limpiarSosNativo();
      })
    );
  }

  async prepararSesionMovimiento() {
    return this.prepararSesionSos();
  }

  async prepararSesionSos() {
    await this.sincronizacionNativa;
    const usuario = this.usuario();
    if (!usuario || !this.nativeToken) throw new Error('Inicia sesión nuevamente para preparar la detección nativa.');
    return { token: this.nativeToken, usuarioId: usuario.id };
  }

  private prepararSosNativo(res: SesionResponse) {
    this.nativeToken = res.token ?? null;
    const token = this.nativeToken;
    this.sincronizacionNativa = this.sincronizacionNativa
      .then(() => this.sincronizarSosNativo(res))
      .catch(() => { if (this.nativeToken === token) this.nativeToken = null; });
  }

  // Sincronización compartida con los servicios nativos de SOS.
  private async sincronizarSosNativo(res: SesionResponse) {
    if (res.token) {
      await Preferences.set({ key: 'jwt_token', value: res.token });
    } else {
      await Preferences.remove({ key: 'jwt_token' });
    }
    await Preferences.set({
      key: 'sos_endpoint',
      value: `${environment.apiUrl}/alerta`, 
    });
  }

  private async limpiarSosNativo() {
    this.nativeToken = null;
    this.sincronizacionNativa = this.sincronizacionNativa.then(async () => {
      await this.movimiento.detener().catch(() => undefined);
      await this.volumen.detener().catch(() => undefined);
      await Preferences.remove({ key: 'jwt_token' });
      await Preferences.remove({ key: 'usuario_id' });
    }).catch(() => undefined);
    await this.sincronizacionNativa;
  }
}
