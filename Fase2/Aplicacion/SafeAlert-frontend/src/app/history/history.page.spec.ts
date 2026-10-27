import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from './history.page';
import { HistoryService } from './history.service';
import { AlertaHistorial } from './history.models';

describe('HistoryPage', () => {
  const api = { listar: vi.fn() };
  let page: HistoryPage;

  const alertaSos: AlertaHistorial = {
    id: 10,
    tipo: 'EMERGENCIA_SOS',
    latitud: -33.4489,
    longitud: -70.6693,
    estado: 'ACTIVA',
    fecha: '2026-10-27 13:06:28.589299+00',
  };
  const alertaVolumen: AlertaHistorial = {
    id: 11,
    tipo: 'EMERGENCIA_VOLUMEN',
    latitud: null,
    longitud: null,
    estado: 'ACTIVA',
    fecha: '2026-10-27 14:00:00+00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.listar.mockReturnValue(of([alertaSos, alertaVolumen]));
    TestBed.configureTestingModule({
      providers: [{ provide: HistoryService, useValue: api }],
    });
    page = TestBed.runInInjectionContext(() => new HistoryPage());
    page.ionViewWillEnter();
  });

  it('carga las alertas al entrar y selecciona la más reciente por defecto', () => {
    expect(page.estado()).toBe('ready');
    expect(page.alertas()).toHaveLength(2);
    expect(page.seleccionada()?.id).toBe(10);
  });

  it('filtra por texto de búsqueda y por método de disparo', () => {
    page.busqueda.set('volumen');
    expect(page.filtradas()).toHaveLength(1);
    expect(page.filtradas()[0].id).toBe(11);

    page.limpiarFiltros();
    page.filtroMetodo.set('BOTON');
    expect(page.filtradas()).toHaveLength(1);
    expect(page.filtradas()[0].id).toBe(10);
  });

  it('formatea correctamente la fecha de Neon DB (+00) al horario de Chile (America/Santiago)', () => {
    const fechaFormateada = page.formatearFechaChile('2026-10-27 13:06:28.589299+00');
    expect(fechaFormateada).toContain('10:06:28');
  });

  it('permite explorar el modo de ejemplo sin llamar al backend', () => {
    vi.clearAllMocks();
    page.verEjemplo();
    expect(page.demo()).toBe(true);
    expect(page.estado()).toBe('ready');
    expect(page.alertas().length).toBeGreaterThan(0);
    expect(api.listar).not.toHaveBeenCalled();
  });

  it('distingue sesión ausente (401) de servicio no disponible y limpia los registros', () => {
    api.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    page.cargar();
    expect(page.estado()).toBe('unauthorized');
    expect(page.alertas()).toHaveLength(0);

    api.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    page.cargar();
    expect(page.estado()).toBe('error');
  });
});