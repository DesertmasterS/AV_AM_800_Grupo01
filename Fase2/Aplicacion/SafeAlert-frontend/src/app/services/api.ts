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

  // Consulta el endpoint "/" que devuelve texto plano ("Hello World!")
  probarConexion(): Observable<string> {
    return this.http.get(this.apiUrl, { responseType: 'text' });
  }
  // 
  enviarAlerta(): Observable<AlertaRegistrada> {
    return this.http.post<AlertaRegistrada>(`${this.apiUrl}/alerta`, {});
  }
}
