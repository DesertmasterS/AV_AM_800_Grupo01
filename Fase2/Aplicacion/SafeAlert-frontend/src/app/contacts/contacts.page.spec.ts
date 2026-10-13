import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactsPage } from './contacts.page';
import { ContactsService } from './contacts.service';
import { ContactoResponse } from './contacts.models';

describe('ContactsPage', () => {
  const api = { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() };
  let page: ContactsPage;
  const contacto = { id: 1, nombre: 'Persona Uno', telefono: '+56900000001', relacion: 'Amigo' };
  beforeEach(() => {
    vi.clearAllMocks();
    api.listar.mockReturnValue(of({ contactos: [contacto] }));
    TestBed.configureTestingModule({ providers: [{ provide: ContactsService, useValue: api }] });
    page = TestBed.runInInjectionContext(() => new ContactsPage());
    page.ionViewWillEnter();
  });
  it('busca por nombre, relación y teléfono', () => {
    page.busqueda.set('persona'); expect(page.filtrados()).toHaveLength(1);
    page.busqueda.set('amigo'); expect(page.filtrados()).toHaveLength(1);
    page.busqueda.set('inexistente'); expect(page.filtrados()).toHaveLength(0);
  });
  it('rechaza formularios inválidos y teléfonos duplicados normalizados', () => {
    page.guardar(); expect(api.crear).not.toHaveBeenCalled();
    page.form.setValue({ nombre: 'Nueva persona', telefono: '+56 9 0000 0001', relacion: '' });
    page.guardar(); expect(api.crear).not.toHaveBeenCalled();
    expect(page.error()).toContain('Ya tienes');
  });
  it('solo modifica el listado tras confirmar el servidor y bloquea envíos duplicados', () => {
    const response = new Subject<ContactoResponse>();
    api.crear.mockReturnValue(response);
    page.form.setValue({ nombre: ' Persona Dos ', telefono: '+56 9 0000 0002', relacion: ' ' });
    page.guardar(); page.guardar();
    expect(api.crear).toHaveBeenCalledTimes(1);
    expect(api.crear).toHaveBeenCalledWith({ nombre: 'Persona Dos', telefono: '+56900000002', relacion: null });
    expect(page.contactos()).toHaveLength(1);
    response.next({ contacto: { id: 2, nombre: 'Persona Dos', telefono: '+56900000002', relacion: null } });
    response.complete();
    expect(page.contactos()).toHaveLength(2);
    expect(page.guardando()).toBe(false);
  });
  it('mantiene los datos ante un fallo de edición', () => {
    api.actualizar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    page.editar(contacto);
    page.form.controls.nombre.setValue('Nuevo nombre');
    page.guardar();
    expect(page.contactos()[0].nombre).toBe('Persona Uno');
    expect(page.editando()).toBe(1);
    expect(page.error()).toContain('No pudimos confirmar');
  });
  it('elimina solo el contacto confirmado y conserva el resto', () => {
    api.eliminar.mockReturnValue(of(undefined));
    page.confirmarEliminar(); expect(api.eliminar).not.toHaveBeenCalled();
    page.porEliminar.set(contacto);
    page.confirmarEliminar();
    expect(api.eliminar).toHaveBeenCalledWith(1);
    expect(page.contactos()).toHaveLength(0);
    expect(page.porEliminar()).toBeNull();
  });
  it('el ejemplo permite editar y eliminar sin llamar al backend', () => {
    page.verEjemplo();
    page.editar(page.contactos()[0]);
    page.form.controls.nombre.setValue('Nombre de ejemplo');
    page.guardar();
    expect(page.contactos()[0].nombre).toBe('Nombre de ejemplo');
    page.porEliminar.set(page.contactos()[0]);
    page.confirmarEliminar();
    expect(page.contactos()).toHaveLength(2);
    expect(api.crear).not.toHaveBeenCalled();
    expect(api.actualizar).not.toHaveBeenCalled();
    expect(api.eliminar).not.toHaveBeenCalled();
  });
  it('distingue sesión ausente de servicio no disponible y limpia los datos anteriores', () => {
    api.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    page.cargar();
    expect(page.estado()).toBe('unauthorized');
    expect(page.contactos()).toHaveLength(0);
    api.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    page.cargar();
    expect(page.estado()).toBe('error');
  });
});
