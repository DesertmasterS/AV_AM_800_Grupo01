import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AlertaRegistrada {
  id: number;
  alertaId?: number;
  mensaje?: string;
  latitud?: number;
  longitud?: number;
  usuarioId?: number | null;
  fecha?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // 1. Usa la misma URL base configurada en tu proyecto
  private readonly apiUrl = environment.apiUrl;

  private readonly http = inject(HttpClient);

  // Consultar el endpoint "/" (health-check)
  probarConexion(): Observable<string> {
    return this.http.get(this.apiUrl, { responseType: 'text' });
  }

  // Envío de alerta con credenciales
  enviarAlerta(datos?: {
    latitud?: number;
    longitud?: number;
    notificarPolicia?: boolean;
  }): Observable<AlertaRegistrada> {
    return this.http.post<AlertaRegistrada>(`${this.apiUrl}/alerta`, datos ?? {}, {
      withCredentials: true,
    });
  }
}