import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { Subject, takeUntil } from 'rxjs';
import { HistoryService } from './history.service';
import { AlertaHistorial } from './history.models';

export type MetodoFiltro = 'TODOS' | 'BOTON' | 'VOLUMEN' | 'MOVIMIENTO';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [IonicModule, RouterLink],
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage {
  private readonly api = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewLeft = new Subject<void>();

  readonly alertas = signal<AlertaHistorial[]>([]);
  readonly busqueda = signal('');
  readonly filtroMetodo = signal<MetodoFiltro>('TODOS');
  readonly estado = signal<'loading' | 'ready' | 'error' | 'unauthorized'>('loading');
  readonly demo = signal(false);
  readonly seleccionada = signal<AlertaHistorial | null>(null);
  readonly error = signal('');

  readonly filtradas = computed(() => {
    const query = this.busqueda().trim().toLocaleLowerCase('es');
    const metodo = this.filtroMetodo();

    return this.alertas().filter((alerta) => {
      const codigo = this.codigoMetodo(alerta.tipo);
      if (metodo !== 'TODOS' && codigo !== metodo) return false;
      if (!query) return true;

      const campos = [
        `#${alerta.id}`,
        String(alerta.id),
        this.nombreMetodo(alerta.tipo),
        alerta.estado ?? '',
        this.formatearFechaChile(alerta.fecha),
      ];
      return campos.some((valor) => valor.toLocaleLowerCase('es').includes(query));
    });
  });

  ionViewWillEnter() {
    if (!this.demo()) this.cargar();
  }

  ionViewDidLeave() {
    this.viewLeft.next();
  }

  cargar() {
    this.demo.set(false);
    this.estado.set('loading');
    this.alertas.set([]);
    this.seleccionada.set(null);
    this.busqueda.set('');
    this.filtroMetodo.set('TODOS');
    this.error.set('');

    this.api
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft))
      .subscribe({
        next: (lista) => {
          this.alertas.set(lista);
          this.seleccionada.set(lista[0] ?? null);
          this.estado.set('ready');
        },
        error: (err: unknown) => {
          this.estado.set(
            err instanceof HttpErrorResponse && err.status === 401 ? 'unauthorized' : 'error',
          );
        },
      });
  }

  verEjemplo() {
    this.demo.set(true);
    this.estado.set('ready');
    this.error.set('');
    this.busqueda.set('');
    this.filtroMetodo.set('TODOS');
    const ejemplos: AlertaHistorial[] = [
      {
        id: 101,
        tipo: 'EMERGENCIA_SOS',
        latitud: -33.4489,
        longitud: -70.6693,
        estado: 'ACTIVA',
        fecha: '2026-10-27 13:06:28.589299+00',
      },
      {
        id: 102,
        tipo: 'EMERGENCIA_VOLUMEN',
        latitud: -33.4372,
        longitud: -70.6506,
        estado: 'ACTIVA',
        fecha: '2026-10-26 22:15:00+00',
      },
      {
        id: 103,
        tipo: 'EMERGENCIA_MOVIMIENTO',
        latitud: null,
        longitud: null,
        estado: 'ACTIVA',
        fecha: '2026-10-25 18:40:10+00',
      },
    ];
    this.alertas.set(ejemplos);
    this.seleccionada.set(ejemplos[0]);
  }

  seleccionar(alerta: AlertaHistorial) {
    this.seleccionada.set(alerta);
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.filtroMetodo.set('TODOS');
  }

  tieneGps(alerta: AlertaHistorial): boolean {
    return alerta.latitud != null && alerta.longitud != null;
  }

  formatearCoordenadas(alerta: AlertaHistorial): string {
    if (!this.tieneGps(alerta)) return 'Sin coordenadas';
    return `${Number(alerta.latitud).toFixed(4)}, ${Number(alerta.longitud).toFixed(4)}`;
  }

  codigoMetodo(tipo: string): 'BOTON' | 'VOLUMEN' | 'MOVIMIENTO' {
    if (tipo?.includes('VOLUMEN')) return 'VOLUMEN';
    if (tipo?.includes('MOVIMIENTO')) return 'MOVIMIENTO';
    return 'BOTON';
  }

  nombreMetodo(tipo: string): string {
    const codigo = this.codigoMetodo(tipo);
    if (codigo === 'VOLUMEN') return 'Botón de volumen';
    if (codigo === 'MOVIMIENTO') return 'Movimiento';
    return 'Botón S.O.S';
  }

  iconoMetodo(tipo: string): string {
    const codigo = this.codigoMetodo(tipo);
    if (codigo === 'VOLUMEN') return 'volume-high-outline';
    if (codigo === 'MOVIMIENTO') return 'phone-portrait-outline';
    return 'alert-outline';
  }

  formatearFechaChile(fechaRaw: string | Date | undefined): string {
    if (!fechaRaw) return '—';

    let fechaObj: Date;
    if (fechaRaw instanceof Date) {
      fechaObj = fechaRaw;
    } else {
      let str = fechaRaw.trim().replace(' ', 'T');
      if (/[+-]\d{2}$/.test(str)) {
        str = `${str}:00`;
      } else if (!str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
        str = `${str}Z`;
      }
      fechaObj = new Date(str);
    }

    if (Number.isNaN(fechaObj.getTime())) return String(fechaRaw);

    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(fechaObj);
  }
}