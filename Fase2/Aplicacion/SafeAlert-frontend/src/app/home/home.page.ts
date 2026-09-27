import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from '../services/api';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {

  constructor(
    private apiService: ApiService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    // Prueba la conexión silenciosamente al iniciar la app
    this.apiService.probarConexion().subscribe({
      next: (res) => console.log('Conexión inicial con NestJS exitosa:', res),
      error: (err) => console.error('Error al conectar con NestJS:', err),
    });
  }

  // Prueba de conexión con el botón SOS
  activarAlerta() {
      this.apiService.enviarAlerta().subscribe({
        next: async (alertaGuardada) => {
          console.log('Registro guardado en Neon:', alertaGuardada);
          await this.mostrarNotificacion(
            `Alerta #${alertaGuardada.id} registrada en Neon con éxito`,
            'success'
          );
        },
        error: async (error) => {
          console.error('Error al persistir en BD:', error);
          await this.mostrarNotificacion('Error al guardar en la base de datos', 'danger');
        },
      });
    }

  private async mostrarNotificacion(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }
}