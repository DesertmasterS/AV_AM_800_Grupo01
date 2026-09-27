import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // Dirección base de tu backend NestJS
  private readonly apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // Consulta el endpoint "/" que devuelve texto plano ("Hello World!")
  probarConexion(): Observable<string> {
    return this.http.get(this.apiUrl, { responseType: 'text' });
  }
  // 
  enviarAlerta(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/alerta`, {});
  }
}