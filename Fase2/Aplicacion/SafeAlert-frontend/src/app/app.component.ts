import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, homeOutline, peopleOutline, navigateOutline, timeOutline, settingsOutline, personOutline, arrowForwardOutline, chevronForwardOutline, locationOutline, checkmarkOutline, alertOutline, radioOutline, lockClosedOutline, closeOutline, informationCircleOutline } from 'ionicons/icons';
@Component({
  selector: 'app-root', templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'], standalone: false,
})
export class AppComponent {
  readonly navigation = [
    { path: '/home', label: 'Inicio', icon: 'home-outline' },
    { path: '/emergency-contacts', label: 'Contactos', icon: 'people-outline' },
    { path: '/companion', label: 'Acompañante', icon: 'navigate-outline' },
    { path: '/history', label: 'Historial', icon: 'time-outline' },
    { path: '/settings', label: 'Ajustes', icon: 'settings-outline' },
  ];
  constructor() {
    addIcons({ shieldCheckmarkOutline, homeOutline, peopleOutline, navigateOutline, timeOutline, settingsOutline, personOutline, arrowForwardOutline, chevronForwardOutline, locationOutline, checkmarkOutline, alertOutline, radioOutline, lockClosedOutline, closeOutline, informationCircleOutline });
  }
}
