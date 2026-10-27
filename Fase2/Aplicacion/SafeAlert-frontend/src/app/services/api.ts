import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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
  usuarioId?: number | null;
  fecha?: string;
}

export interface AlertaPublica {
  id: number;
  alertaId: number;
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
  // 
  private readonly apiUrl = environment.apiUrl;

  private readonly http = inject(HttpClient);

  // Identificador del rastreo GPS continuo en vivo
  private watchId: number | null = null;

  // Consultar el endpoint "/" (health-check)
  probarConexion(): Observable<string> {
    return this.http.get(this.apiUrl, { responseType: 'text' });
  }

  // Envío de alerta con credenciales + activación automática de GPS en tiempo real
  enviarAlerta(datos?: {
    latitud?: number;
    longitud?: number;
    notificarPolicia?: boolean;
    origen?: 'BOTON' | 'MOVIMIENTO' | 'VOLUMEN';
    eventoId?: string;
  }): Observable<AlertaRegistrada> {
    return this.http
      .post<AlertaRegistrada>(`${this.apiUrl}/alerta`, datos ?? {}, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => {
          const alertaId = res?.id ?? res?.alertaId;
          if (alertaId) {
            this.iniciarTransmisionGpsEnVivo(alertaId);
          }
        }),
      );
  }

  // Actualiza la coordenada en vivo de una alerta activa 
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

  // Obtiene los datos en vivo de una alerta para la vista "Modo Acompañante"
  obtenerAlertaEnVivo(alertaId: number): Observable<AlertaPublica> {
    return this.http.get<AlertaPublica>(`${this.apiUrl}/alerta/publica/${alertaId}`);
  }

  // Inicia el envío continuo de coordenadas cada vez que el usuario se desplaza
  iniciarTransmisionGpsEnVivo(alertaId: number): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation || typeof navigator.geolocation.watchPosition !== 'function') {
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
      // Ignorar si el entorno no soporta geolocalización continua
    }
  }

  // Detiene la transmisión continua de GPS
  detenerTransmisionGps(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
  // Consulta si el usuario tiene una alerta ACTIVA en curso (GET /alerta/activa)
  obtenerAlertaActivaUsuario(): Observable<{ activa: AlertaRegistrada | null }> {
    return this.http.get<{ activa: AlertaRegistrada | null }>(
      `${this.apiUrl}/alerta/activa`,
      { withCredentials: true },
    );
  }

  // Detiene la alerta activa en el servidor y apaga la transmisión de GPS local (PATCH /alerta/:id/detener)
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
        }),
      );
  }
}