import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { Subject, finalize, takeUntil, timeout } from 'rxjs';
import { AlertaPublica, ApiService } from '../services/api';

declare const L: any;

@Component({
  selector: 'app-companion',
  standalone: true,
  imports: [IonicModule],
  templateUrl: './companion.page.html',
  styleUrls: ['./companion.page.scss'],
})
export class CompanionPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewLeft = new Subject<void>();

  private readonly COORDS_SANTIAGO = { latitud: -33.4489, longitud: -70.6693 };

  readonly codigoSeguimiento = signal('');
  readonly alertasCompartidas = signal<AlertaPublica[]>([]);
  readonly alertaActiva = signal<AlertaPublica | null>(null);
  readonly ultimaActualizacion = signal('—');
  readonly demo = signal(false);
  readonly iniciando = signal(false);
  readonly transmitiendo = signal(false);
  readonly cargandoAlerta = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');

  private map: any = null;
  private marker: any = null;
  private circle: any = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    await this.cargarLeafletCdn();
    this.inicializarMapaBase();
    this.cargarAlertasCompartidasConmigo();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const codigoParam = (params.get('codigo') || params.get('alertaId') || params.get('id'))?.trim();
      if (codigoParam && codigoParam !== 'undefined' && codigoParam !== 'null') {
        this.codigoSeguimiento.set(codigoParam);
        this.iniciarSeguimiento(codigoParam);
      } else {
        // Si entró sin código en la URL, verificar si el propio usuario tiene una alerta activa
        this.verificarMiPropiaAlertaActiva();
      }
    });
  }

  private verificarMiPropiaAlertaActiva(): void {
    if (!('obtenerAlertaActivaUsuario' in this.api)) {
      this.centrarEnUbicacionLocal();
      return;
    }
    this.api
      .obtenerAlertaActivaUsuario()
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft))
      .subscribe({
        next: (res) => {
          const activa = res?.activa;
          const codigoPropio = activa?.eventoId || (activa?.id ? String(activa.id) : '');
          if (codigoPropio) {
            this.transmitiendo.set(true);
            this.codigoSeguimiento.set(codigoPropio);
            this.iniciarSeguimiento(codigoPropio);
          } else if (!this.demo()) {
            this.centrarEnUbicacionLocal();
          }
        },
        error: () => {
          if (!this.demo()) this.centrarEnUbicacionLocal();
        },
      });
  }

  ionViewWillEnter(): void {
    const codigoActual = this.codigoSeguimiento();
    if (codigoActual && !this.demo()) {
      this.iniciarSeguimiento(codigoActual);
    } else if (!this.demo()) {
      this.cargarAlertasCompartidasConmigo();
    }
  }

  ionViewDidLeave(): void {
    this.viewLeft.next();
    this.detenerPolling();
  }

  ngOnDestroy(): void {
    this.viewLeft.next();
    this.detenerPolling();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  cargarAlertasCompartidasConmigo(): void {
    if (!('obtenerAlertasCompartidas' in this.api)) return;
    this.api
      .obtenerAlertasCompartidas()
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft))
      .subscribe({
        next: (lista) => {
          this.alertasCompartidas.set(lista ?? []);
          if (!this.codigoSeguimiento() && lista?.length) {
            const primeraConCodigo = lista.find((a) => Boolean(a.eventoId));
            if (primeraConCodigo?.eventoId) {
              this.seleccionarCompartida(primeraConCodigo);
            }
          }
        },
        error: () => {
          this.alertasCompartidas.set([]);
        },
      });
  }

  seleccionarCompartida(alerta: AlertaPublica): void {
    if (!alerta.eventoId) return;
    this.demo.set(false);
    this.error.set('');
    this.mensaje.set('');
    this.codigoSeguimiento.set(alerta.eventoId);
    this.iniciarSeguimiento(alerta.eventoId);
  }

  iniciarMiTrayecto(): void {
    if (this.iniciando()) return;
    this.demo.set(false);
    this.iniciando.set(true);
    this.error.set('');
    this.mensaje.set('Obteniendo ubicación GPS y enviando enlace por WhatsApp a tus contactos…');

    let respondioGps = false;
    const timerRescate = setTimeout(() => {
      if (!respondioGps) {
        respondioGps = true;
        this.despacharAlerta(this.COORDS_SANTIAGO.latitud, this.COORDS_SANTIAGO.longitud, true);
      }
    }, 3500);

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (respondioGps) return;
          respondioGps = true;
          clearTimeout(timerRescate);
          this.despacharAlerta(pos.coords.latitude, pos.coords.longitude, false);
        },
        () => {
          if (respondioGps) return;
          respondioGps = true;
          clearTimeout(timerRescate);
          this.despacharAlerta(this.COORDS_SANTIAGO.latitud, this.COORDS_SANTIAGO.longitud, true);
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 },
      );
    } else {
      respondioGps = true;
      clearTimeout(timerRescate);
      this.despacharAlerta(this.COORDS_SANTIAGO.latitud, this.COORDS_SANTIAGO.longitud, true);
    }
  }

  detenerMiTrayecto(): void {
    const id = this.alertaActiva()?.id;
    this.api.detenerTransmisionGps();
    this.transmitiendo.set(false);
    this.detenerPolling();

    if (id && id > 0 && !this.demo() && 'detenerAlerta' in this.api) {
      this.api
        .detenerAlerta(id)
        .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.viewLeft))
        .subscribe({
          next: () => {
            const actual = this.alertaActiva();
            if (actual) {
              this.alertaActiva.set({ ...actual, estado: 'FINALIZADA' });
            }
            this.error.set('');
            this.mensaje.set(`Alerta #${id} detenida y marcada como FINALIZADA.`);
            this.cargarAlertasCompartidasConmigo();
          },
          error: () => {
            this.mensaje.set('Transmisión local detenida.');
          },
        });
    } else {
      this.error.set('');
      this.mensaje.set('Transmisión de ubicación en tiempo real detenida correctamente.');
    }
  }

  verEjemplo(): void {
    this.detenerPolling();
    this.demo.set(true);
    this.error.set('');
    this.mensaje.set('Explorando trayecto simulado en tiempo real.');
    const simulada: AlertaPublica = {
      id: 99,
      alertaId: 99,
      eventoId: 'demo-uuid-99',
      nombreUsuario: 'Sofía Martínez (Ejemplo)',
      tipo: 'EMERGENCIA_SOS',
      estado: 'ACTIVA',
      latitud: this.COORDS_SANTIAGO.latitud,
      longitud: this.COORDS_SANTIAGO.longitud,
      fecha: new Date().toISOString(),
    };
    this.alertaActiva.set(simulada);
    this.ultimaActualizacion.set(this.horaChileActual());
    this.actualizarPinEnMapa(simulada.latitud!, simulada.longitud!, `🚨 ${simulada.nombreUsuario}`);
  }

  salirEjemplo(): void {
    this.demo.set(false);
    this.alertaActiva.set(null);
    this.mensaje.set('');
    this.error.set('');
    this.centrarEnUbicacionLocal();
  }

  tieneGps(alerta: AlertaPublica): boolean {
    return alerta.latitud != null && alerta.longitud != null;
  }

  formatearCoordenadas(alerta: AlertaPublica): string {
    if (!this.tieneGps(alerta)) return 'Sin coordenadas';
    return `${Number(alerta.latitud).toFixed(4)}, ${Number(alerta.longitud).toFixed(4)}`;
  }

  iniciarSeguimiento(codigo: string): void {
    this.detenerPolling();
    this.consultarPosicion(codigo);
    this.pollingTimer = setInterval(() => {
      this.consultarPosicion(codigo);
    }, 4000);
  }

  private despacharAlerta(latitud: number, longitud: number, usandoRespaldoPc: boolean): void {
    const nuevoEventoId = crypto.randomUUID();
    this.api
      .enviarAlerta({
        latitud,
        longitud,
        origen: 'BOTON',
        eventoId: nuevoEventoId,
      })
      .pipe(
        timeout(15000),
        takeUntilDestroyed(this.destroyRef),
        takeUntil(this.viewLeft),
        finalize(() => this.iniciando.set(false)),
      )
      .subscribe({
        next: (res) => {
          this.transmitiendo.set(true);
          const id = res.id ?? res.alertaId;
          const codigo = res.eventoId || nuevoEventoId;
          this.codigoSeguimiento.set(codigo);
          this.error.set('');
          this.mensaje.set(
            usandoRespaldoPc
              ? `Trayecto #${id} activo con ubicación de prueba. Enlace enviado por WhatsApp a tu red.`
              : `Trayecto #${id} activo. Tus contactos recibieron el mapa en vivo por WhatsApp.`,
          );
          this.iniciarSeguimiento(codigo);
          this.cargarAlertasCompartidasConmigo();
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.error.set('Tu sesión no está disponible. Inicia sesión para compartir tu trayecto en vivo.');
          } else {
            this.error.set('No pudimos iniciar el trayecto en vivo. Revisa tu conexión e inténtalo de nuevo.');
          }
          this.mensaje.set('');
        },
      });
  }

  private consultarPosicion(codigo: string): void {
    this.cargandoAlerta.set(true);
    this.api
      .obtenerAlertaEnVivo(codigo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        takeUntil(this.viewLeft),
        finalize(() => this.cargandoAlerta.set(false)),
      )
      .subscribe({
        next: (data) => {
          this.alertaActiva.set(data);
          this.ultimaActualizacion.set(this.horaChileActual());
          this.error.set('');

          if (data.latitud != null && data.longitud != null) {
            this.actualizarPinEnMapa(
              Number(data.latitud),
              Number(data.longitud),
              `🚨 ${data.nombreUsuario}`,
            );
          }
        },
        error: () => {
          this.detenerPolling();
          this.error.set('No tienes acceso a esta alerta o el código de seguimiento no es válido.');
        },
      });
  }

  private detenerPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private horaChileActual(): string {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  private centrarEnUbicacionLocal(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.actualizarPinEnMapa(this.COORDS_SANTIAGO.latitud, this.COORDS_SANTIAGO.longitud, '📍 Ubicación base');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.actualizarPinEnMapa(pos.coords.latitude, pos.coords.longitude, '📍 Tu ubicación actual');
      },
      () => {
        this.actualizarPinEnMapa(this.COORDS_SANTIAGO.latitud, this.COORDS_SANTIAGO.longitud, 'Santiago de Chile');
      },
      { enableHighAccuracy: false, timeout: 3000 },
    );
  }

  private inicializarMapaBase(): void {
    if (typeof L === 'undefined' || this.map) return;
    const container = typeof document !== 'undefined' ? document.getElementById('companion-map') : null;
    if (!container) return;

    this.map = L.map('companion-map').setView([this.COORDS_SANTIAGO.latitud, this.COORDS_SANTIAGO.longitud], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private actualizarPinEnMapa(lat: number, lng: number, etiqueta: string): void {
    if (typeof L === 'undefined' || !this.map) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const coords = [lat, lng];

    
    const popupSeguro = typeof document !== 'undefined' ? document.createElement('strong') : etiqueta;
    if (typeof popupSeguro !== 'string') {
      popupSeguro.textContent = etiqueta;
    }

    if (!this.marker) {
      this.marker = L.marker(coords).addTo(this.map).bindPopup(popupSeguro).openPopup();
      this.circle = L.circle(coords, {
        color: '#246d60',
        fillColor: '#246d60',
        fillOpacity: 0.2,
        radius: 30,
      }).addTo(this.map);
      this.map.setView(coords, 16);
    } else {
      this.marker.setLatLng(coords).setPopupContent(popupSeguro);
      this.circle.setLatLng(coords);
      this.map.panTo(coords, { animate: true });
    }
  }

  private cargarLeafletCdn(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined' || typeof L !== 'undefined') {
        resolve();
        return;
      }
      if (document.querySelector('script[data-leaflet="true"]')) {
        resolve();
        return;
      }
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      css.crossOrigin = 'anonymous';
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = 'anonymous';
      script.setAttribute('data-leaflet', 'true');
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.body.appendChild(script);
    });
  }
}