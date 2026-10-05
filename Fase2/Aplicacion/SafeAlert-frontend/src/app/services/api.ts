import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AlertaRegistrada {
  id: number;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // Dirección base de tu backend NestJS
  private readonly apiUrl = 'http://localhost:3000';

  private readonly http = inject(HttpClient);

  // Consultar el endpoint "/" 
  probarConexion(): Observable<string> {
    return this.http.get(this.apiUrl, { responseType: 'text' });
  }
  // Se hace opcional la notificación a carabineros
  enviarAlerta(datos?: { latitud?: number; longitud?: number; notificarPolicia?: boolean }) {
    return this.http.post<any>(`${this.apiUrl}/alerta`, datos ?? {});
  }
}
