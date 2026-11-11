import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap, defer, switchMap } from 'rxjs';
import { WidgetService } from '../settings/widget/widget.service';
import { BatteryService } from './battery.service';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';

export interface AlertaRegistrada {
  id: number;
  alertaId?: number;
  mensaje?: string;
  latitud?: number | null;
  longitud?: number | null;
  origen?: 'BOTON' | 'MOVIMIENTO' | 'VOLUMEN';
  eventoId?: string | null;
  duplicada?: boolean;
  yaActiva?: boolean;
  usuarioId?: number | null;
  fecha?: string;
}

export interface AlertaPublica {
  id: number;
  alertaId: number;
  eventoId?: string | null;
  nombreUsuario: string;
  tipo: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  fecha: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  private readonly widget = inject(WidgetService);
  private readonly battery = inject(BatteryService);
  private watchId: number | null = null;

  // Emite un evento cada vez que se crea o detiene una alerta dentro de la app
  private readonly alertaActualizadaSubject = new Subject<void>();
  readonly cambiosAlerta$ = this.alertaActualizadaSubject.asObservable();

  probarConexion(): Observable<string> {
  const url = this.apiUrl === '/api' ? '/api/' : this.apiUrl;
  return this.http.get(url, { responseType: 'text' });
}

  enviarAlerta(datos?: {
    latitud?: number;
    longitud?: number;
    origen?: 'BOTON' | 'MOVIMIENTO' | 'VOLUMEN';
    eventoId?: string;
  }): Observable<AlertaRegistrada> {
    return defer(() => this.battery.readPercentage()).pipe(
      switchMap(bateriaPorcentaje => this.http.post<AlertaRegistrada>(
        `${this.apiUrl}/alerta`,
        { ...datos, ...(bateriaPorcentaje === undefined ? {} : { bateriaPorcentaje }) },
        { withCredentials: true },
      )),
    )
      .pipe(
        tap((res) => {
          const alertaId = res?.id ?? res?.alertaId;
          if (alertaId) {
            this.iniciarTransmisionGpsEnVivo(alertaId);
          }
          this.widget.refrescar();
          this.alertaActualizadaSubject.next();
        }),
      );
  }

  obtenerAlertaActivaUsuario(): Observable<{ activa: AlertaRegistrada | null }> {
    return this.http.get<{ activa: AlertaRegistrada | null }>(
      `${this.apiUrl}/alerta/activa`,
      { withCredentials: true },
    );
  }

  detenerAlerta(alertaId: number): Observable<{ mensaje: string; id: number; estado: string }> {
    return this.http
      .patch<{ mensaje: string; id: number; estado: string }>(
        `${this.apiUrl}/alerta/${alertaId}/detener`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap(() => {
          this.detenerTransmisionGps();
          this.widget.refrescar();
          this.alertaActualizadaSubject.next();
          void Preferences.set({
            key: 'stopped_alert_id',
            value: `${alertaId}:${Date.now()}`,
          }).catch(() => undefined);
        }),
      );
  }

  actualizarUbicacionAlerta(
    alertaId: number,
    latitud: number,
    longitud: number,
  ): Observable<AlertaRegistrada> {
    return this.http.patch<AlertaRegistrada>(
      `${this.apiUrl}/alerta/${alertaId}/ubicacion`,
      { latitud, longitud },
      { withCredentials: true },
    );
  }

  obtenerAlertaEnVivo(codigo: string | number): Observable<AlertaPublica> {
    return this.http.get<AlertaPublica>(
      `${this.apiUrl}/alerta/publica/${encodeURIComponent(String(codigo))}`,
      { withCredentials: true },
    );
  }

  obtenerAlertasCompartidas(): Observable<AlertaPublica[]> {
    return this.http.get<AlertaPublica[]>(`${this.apiUrl}/alerta/compartidas`, {
      withCredentials: true,
    });
  }

  iniciarTransmisionGpsEnVivo(alertaId: number): void {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      typeof navigator.geolocation.watchPosition !== 'function'
    ) {
      return;
    }

    this.detenerTransmisionGps();

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          this.actualizarUbicacionAlerta(alertaId, latitude, longitude).subscribe({
            error: (err) => console.warn('No se pudo actualizar GPS en vivo:', err),
          });
        },
        (err) => console.warn('Aviso lectura GPS continuo:', err),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        },
      );
    } catch {
      
    }
  }

  detenerTransmisionGps(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}