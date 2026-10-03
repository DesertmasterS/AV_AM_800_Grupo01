import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'home', loadChildren: () => import('./home/home.module').then(m => m.HomePageModule) },
  {
    path: 'emergency-contacts', loadComponent: () => import('./views/section.page').then(m => m.SectionPage),
    data: { title: 'Mis contactos', eyebrow: 'TU RED DE CONFIANZA', description: 'organizar tus contactos de emergencia.', icon: 'people-outline', areas: [
      { title: 'Contactos de emergencia', icon: 'people-outline' },
      { title: 'Agregar un contacto', icon: 'person-outline' },
      { title: 'Prioridad de notificación', icon: 'radio-outline' },
    ] },
  },
  {
    path: 'companion', loadComponent: () => import('./views/section.page').then(m => m.SectionPage),
    data: { title: 'Modo acompañante', eyebrow: 'CADA TRAYECTO, EN COMPAÑÍA', description: 'compartir un trayecto con tu red de confianza.', icon: 'navigate-outline', areas: [
      { title: 'Mi trayecto', icon: 'navigate-outline' },
      { title: 'Elegir acompañante', icon: 'people-outline' },
      { title: 'Confirmar llegada', icon: 'checkmark-outline' },
    ] },
  },
  {
    path: 'history', loadComponent: () => import('./views/section.page').then(m => m.SectionPage),
    data: { title: 'Historial de alertas', eyebrow: 'TUS REGISTROS', description: 'consultar el registro y estado de tus alertas.', icon: 'time-outline', areas: [
      { title: 'Alertas registradas', icon: 'time-outline' },
      { title: 'Detalle de la alerta', icon: 'alert-outline' },
      { title: 'Contactos notificados', icon: 'people-outline' },
    ] },
  },
  {
    path: 'settings', loadComponent: () => import('./views/section.page').then(m => m.SectionPage),
    data: { title: 'Ajustes de seguridad', eyebrow: 'TU SEGURIDAD, A TU MANERA', description: 'configurar los permisos y la activación de alertas.', icon: 'settings-outline', areas: [
      { title: 'Ubicación y micrófono', icon: 'location-outline' },
      { title: 'Activación y cancelación', icon: 'radio-outline' },
      { title: 'Privacidad y datos', icon: 'lock-closed-outline' },
    ] },
  },
  {
    path: 'profile', loadComponent: () => import('./views/section.page').then(m => m.SectionPage),
    data: { title: 'Mi perfil', eyebrow: 'TU ESPACIO PERSONAL', description: 'administrar tu información personal y tu cuenta.', icon: 'person-outline', areas: [
      { title: 'Información personal', icon: 'person-outline' },
      { title: 'Acceso y cuenta', icon: 'shield-checkmark-outline' },
      { title: 'Consentimiento y términos', icon: 'lock-closed-outline' },
    ] },
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
