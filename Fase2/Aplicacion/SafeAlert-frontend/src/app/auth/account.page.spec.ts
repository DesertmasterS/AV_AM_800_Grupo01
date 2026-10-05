import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPage } from './account.page';
import { AuthService } from './auth.service';
import { SesionResponse } from './auth.models';

describe('AccountPage', () => {
  const auth = { registrar: vi.fn(), iniciarSesion: vi.fn() };
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  function crear(registro = true) {
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { registro } } } },
    ] });
    return TestBed.runInInjectionContext(() => new AccountPage());
  }
  function completar(page: AccountPage) {
    page.form.setValue({ nombre: ' Nombre ', apellido: ' Apellido ', telefono: '+56 9 1234 5678', email: 'DEMO@example.test', password: 'clave-de-prueba' });
  }
  beforeEach(() => vi.clearAllMocks());

  it('rechaza campos vacíos y un teléfono sin código de país', () => {
    const page = crear();
    page.enviar();
    expect(auth.registrar).not.toHaveBeenCalled();
    completar(page);
    page.form.controls.telefono.setValue('912345678');
    page.enviar();
    expect(auth.registrar).not.toHaveBeenCalled();
  });
  it('normaliza el DTO y bloquea el envío duplicado', () => {
    const response = new Subject<SesionResponse>();
    auth.registrar.mockReturnValue(response);
    const page = crear();
    completar(page);
    page.enviar();
    page.enviar();
    expect(auth.registrar).toHaveBeenCalledTimes(1);
    expect(auth.registrar).toHaveBeenCalledWith({ nombre: 'Nombre', apellido: 'Apellido', telefono: '+56912345678', email: 'demo@example.test', password: 'clave-de-prueba' });
    response.next({ usuario: { id: 1, nombre: 'Nombre', apellido: 'Apellido', telefono: '+56912345678', email: 'demo@example.test' } });
    response.complete();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/profile', { replaceUrl: true });
    expect(page.form.controls.password.value).toBe('');
    expect(page.enviando()).toBe(false);
  });
  it('inicio de sesión solo solicita correo y clave', () => {
    auth.iniciarSesion.mockReturnValue(of({ usuario: {} }));
    const page = crear(false);
    page.form.patchValue({ email: 'demo@example.test', password: 'clave' });
    page.enviar();
    expect(auth.iniciarSesion).toHaveBeenCalledWith({ email: 'demo@example.test', password: 'clave' });
    expect(auth.registrar).not.toHaveBeenCalled();
  });
  it('no simula una cuenta cuando el backend falla y limpia la clave', () => {
    auth.registrar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const page = crear();
    completar(page);
    page.enviar();
    expect(page.error()).toContain('Ya existe una cuenta');
    expect(page.form.controls.password.value).toBe('');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(page.enviando()).toBe(false);
  });
  it('cancela una petición pendiente cuando se abandona la pantalla', () => {
    const response = new Subject<SesionResponse>();
    auth.registrar.mockReturnValue(response);
    const page = crear();
    completar(page);
    page.enviar();
    page.ionViewDidLeave();
    expect(page.enviando()).toBe(false);
    expect(page.form.controls.password.value).toBe('');
    response.next({ usuario: { id: 1, nombre: 'Nombre', apellido: 'Apellido', telefono: '+56912345678', email: 'demo@example.test' } });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
