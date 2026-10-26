import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { ApiService, AlertaPublica } from '../services/api';

declare const L: any;

@Component({
  selector: 'app-companion',
  templateUrl: './companion.page.html',
  styleUrls: ['./companion.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterLink],
})
export class CompanionPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  alertaIdInput: number | null = null;
  alertaActiva: AlertaPublica | null = null;
  ultimaActualizacion = '-';
  mensajeEstado = '';
  errorEstado = false;
  iniciando = false;
  transmitiendoLocal = false;

  private map: any = null;
  private marker: any = null;
  private circle: any = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    await this.cargarLeafletCdn();
    this.inicializarMapaBase();

    this.route.queryParamMap.subscribe((params) => {
      const idParam = Number(params.get('alertaId') || params.get('id'));
      if (idParam > 0) {
        this.alertaIdInput = idParam;
        this.iniciarSeguimientoAlerta(idParam);
      } else {
        this.centrarEnUbicacionLocal();
      }
    });
  }

  ngOnDestroy(): void {
    this.detenerPolling();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  seguirAlertaManual(): void {
    if (!this.alertaIdInput || this.alertaIdInput <= 0) {
      this.errorEstado = true;
      this.mensajeEstado = 'Ingresa un ID de alerta válido para monitorear.';
      return;
    }
    this.errorEstado = false;
    this.iniciarSeguimientoAlerta(this.alertaIdInput);
  }

  iniciarMiTrayectoEnVivo(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.errorEstado = true;
      this.mensajeEstado = 'Tu navegador o dispositivo no soporta geolocalización.';
      return;
    }

    this.iniciando = true;
    this.errorEstado = false;
    this.mensajeEstado = 'Obteniendo señal GPS y enviando enlace por WhatsApp a tus contactos…';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.api
          .enviarAlerta({
            latitud: latitude,
            longitud: longitude,
            origen: 'BOTON',
            eventoId: crypto.randomUUID(),
          })
          .subscribe({
            next: (res) => {
              this.iniciando = false;
              this.transmitiendoLocal = true;
              const id = res.id ?? res.alertaId;
              if (id) {
                this.alertaIdInput = id;
                this.errorEstado = false;
                this.mensajeEstado = `Trayecto #${id} activo. Tus contactos recibieron el mapa en vivo por WhatsApp.`;
                this.iniciarSeguimientoAlerta(id);
              }
            },
            error: () => {
              this.iniciando = false;
              this.errorEstado = true;
              this.mensajeEstado = 'No se pudo iniciar el trayecto. Verifica haber iniciado sesión.';
            },
          });
      },
      () => {
        this.iniciando = false;
        this.errorEstado = true;
        this.mensajeEstado = 'Permiso de ubicación denegado. Activa el GPS para compartir tu ruta.';
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  detenerMiTrayecto(): void {
    this.api.detenerTransmisionGps();
    this.transmitiendoLocal = false;
    this.mensajeEstado = 'Transmisión de GPS en tiempo real detenida en este dispositivo.';
  }

  iniciarSeguimientoAlerta(alertaId: number): void {
    this.detenerPolling();
    this.consultarPosicion(alertaId);
    this.pollingTimer = setInterval(() => {
      this.consultarPosicion(alertaId);
    }, 4000);
  }

  private detenerPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private consultarPosicion(alertaId: number): void {
    this.api.obtenerAlertaEnVivo(alertaId).subscribe({
      next: (data) => {
        this.alertaActiva = data;
        this.ultimaActualizacion = new Date().toLocaleTimeString('es-CL');

        if (data.latitud != null && data.longitud != null) {
          this.errorEstado = false;
          this.actualizarPinEnMapa(
            Number(data.latitud),
            Number(data.longitud),
            `🚨 ${data.nombreUsuario}`,
          );
        } else {
          this.mensajeEstado = 'Alerta activa, esperando primera coordenada GPS del dispositivo…';
        }
      },
      error: () => {
        this.errorEstado = true;
        this.mensajeEstado = `No se encontró información para la alerta #${alertaId}.`;
      },
    });
  }

  private centrarEnUbicacionLocal(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.actualizarPinEnMapa(
          pos.coords.latitude,
          pos.coords.longitude,
          '📍 Tu ubicación actual',
        );
      },
      () => {
        this.actualizarPinEnMapa(-33.4489, -70.6693, 'Santiago de Chile');
      },
    );
  }

  private inicializarMapaBase(): void {
    if (typeof L === 'undefined' || this.map) return;
    const container = document.getElementById('companion-map');
    if (!container) return;

    this.map = L.map('companion-map').setView([-33.4489, -70.6693], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private actualizarPinEnMapa(lat: number, lng: number, etiqueta: string): void {
    if (typeof L === 'undefined' || !this.map) return;

    const coords = [lat, lng];
    if (!this.marker) {
      this.marker = L.marker(coords).addTo(this.map).bindPopup(etiqueta).openPopup();
      this.circle = L.circle(coords, {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.2,
        radius: 30,
      }).addTo(this.map);
      this.map.setView(coords, 17);
    } else {
      this.marker.setLatLng(coords).setPopupContent(etiqueta);
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
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.setAttribute('data-leaflet', 'true');
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.body.appendChild(script);
    });
  }
}