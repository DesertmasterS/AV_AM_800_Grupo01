import { environment } from '../../environments/environment';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let http: HttpTestingController;
  const url = environment.apiUrl + '/contactos-emergencia';
  const datos = { nombre: 'Contacto', telefono: '+56900000001', relacion: 'Amigo' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ContactsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('usa el contrato CRUD con sesión y sin usuario_id en el cuerpo', () => {
    service.listar().subscribe();
    const list = http.expectOne(url);
    expect(list.request.method).toBe('GET');
    expect(list.request.withCredentials).toBe(true);
    list.flush({ contactos: [] });
    service.crear(datos).subscribe();
    const create = http.expectOne(url);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(datos);
    expect(create.request.withCredentials).toBe(true);
    create.flush({ contacto: { id: 1, ...datos } });
    service.actualizar(1, datos).subscribe();
    const update = http.expectOne(url + '/1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.withCredentials).toBe(true);
    expect(update.request.body).toEqual(datos);
    update.flush({ contacto: { id: 1, ...datos } });
    service.eliminar(1).subscribe();
    const remove = http.expectOne(url + '/1');
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.withCredentials).toBe(true);
    remove.flush(null);
  });
});
