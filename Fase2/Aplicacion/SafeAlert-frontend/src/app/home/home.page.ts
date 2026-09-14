import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  constructor() {}

  activarAlerta() {
    console.log('¡Alerta de pánico activada!');
    // Más adelante aquí pondremos la lógica del GPS y WhatsApp
  }
}
