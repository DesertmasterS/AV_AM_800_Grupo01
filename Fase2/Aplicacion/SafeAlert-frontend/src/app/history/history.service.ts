import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { HistorialResponse } from './history.models';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/alerta/historial';
  private readonly options = { withCredentials: true };

  listar() {
    return this.http.get<HistorialResponse>(this.url, this.options).pipe(
      timeout(10000),
      map((res) => (Array.isArray(res) ? res : (res?.alertas ?? []))),
    );
  }
}