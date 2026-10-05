import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home.page';
import { ApiService, AlertaRegistrada } from '../services/api';
import { AppComponent } from '../app.component';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  const api = { probarConexion: vi.fn(), enviarAlerta: vi.fn() };
  const toast = { create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }) };

  beforeEach(async () => {
    new AppComponent();
    vi.clearAllMocks();
    api.probarConexion.mockReturnValue(of('OK'));
    await TestBed.configureTestingModule({
      declarations: [HomePage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: ToastController, useValue: toast }],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra el estado real de conexión y permite volver a comprobarlo', () => {
    expect(component.conexion).toBe('online');
    api.probarConexion.mockReturnValue(throwError(() => new Error('offline')));
    component.verificarConexion();
    expect(component.conexion).toBe('offline');
  });

  it('bloquea envíos duplicados mientras se registra la alerta', () => {
    const response = new Subject<AlertaRegistrada>();
    api.enviarAlerta.mockReturnValue(response);
    component.activarAlerta();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.panic-btn').disabled).toBe(true);
    component.activarAlerta();
    expect(api.enviarAlerta).toHaveBeenCalledTimes(1);
    response.next({ id: 12 });
    response.complete();
    expect(component.enviando).toBe(false);
    expect(component.resultado).toContain('#12');
    expect(component.errorAlerta).toBe(false);
  });

  it('informa el fallo y permite reintentar sin afirmar que hubo notificaciones', () => {
    api.enviarAlerta.mockReturnValue(throwError(() => new Error('offline')));
    component.activarAlerta();
    expect(component.enviando).toBe(false);
    expect(component.errorAlerta).toBe(true);
    expect(component.resultado).toContain('No se pudo confirmar');
  });
});
