import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  const usuario = { id: 1, nombre: 'Nombre', apellido: 'Apellido', telefono: '+56912345678', email: 'demo@example.test' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('solo establece la sesión tras una respuesta exitosa del servidor', () => {
    auth.iniciarSesion({ email: usuario.email, password: 'clave-de-prueba' }).subscribe();
    const request = http.expectOne('http://localhost:3000/auth/login');
    expect(request.request.withCredentials).toBe(true);
    expect(auth.usuario()).toBeNull();
    request.flush({ usuario });
    expect(auth.usuario()).toEqual(usuario);
  });
  it('recupera una sesión con me y la elimina al recibir un 401', () => {
    auth.actualizarSesion();
    http.expectOne('http://localhost:3000/auth/me').flush({ usuario });
    expect(auth.usuario()).toEqual(usuario);
    auth.actualizarSesion();
    http.expectOne('http://localhost:3000/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.usuario()).toBeNull();
    expect(auth.verificando()).toBe(false);
  });
  it('distingue un fallo de servicio de una sesión expirada', () => {
    auth.actualizarSesion();
    http.expectOne('http://localhost:3000/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.errorSesion()).toContain('No se pudo verificar');
    expect(auth.verificando()).toBe(false);
  });
  it('envía todos los campos del registro y confirma el cierre con el servidor', () => {
    const datos = { ...usuario, password: 'clave-de-prueba' };
    const { id: _id, ...registro } = datos;
    auth.registrar(registro).subscribe();
    const request = http.expectOne('http://localhost:3000/auth/register');
    expect(request.request.body).toEqual(registro);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ usuario });
    auth.cerrarSesion().subscribe();
    const logout = http.expectOne('http://localhost:3000/auth/logout');
    expect(logout.request.method).toBe('POST');
    logout.flush(null);
    expect(auth.usuario()).toBeNull();
  });
});
