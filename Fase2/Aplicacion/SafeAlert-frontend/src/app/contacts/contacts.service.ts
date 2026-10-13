import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContactoRequest, ContactoResponse, ContactosResponse } from './contacts.models';

@Injectable({ providedIn: 'root' })
export class ContactsService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/contactos-emergencia';
  private readonly options = { withCredentials: true };
  listar() { return this.http.get<ContactosResponse>(this.url, this.options).pipe(timeout(10000)); }
  crear(datos: ContactoRequest) { return this.http.post<ContactoResponse>(this.url, datos, this.options).pipe(timeout(15000)); }
  actualizar(id: number, datos: ContactoRequest) { return this.http.patch<ContactoResponse>(this.url + '/' + id, datos, this.options).pipe(timeout(15000)); }
  eliminar(id: number) { return this.http.delete<void>(this.url + '/' + id, this.options).pipe(timeout(15000)); }
}
