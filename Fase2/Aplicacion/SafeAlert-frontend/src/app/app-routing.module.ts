import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'home', loadChildren: () => import('./home/home.module').then(m => m.HomePageModule) },
  {
    path: 'emergency-contacts', loadComponent: () => import('./contacts/contacts.page').then(m => m.ContactsPage),
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
    path: 'settings', loadComponent: () => import('./settings/settings.page').then(m => m.SettingsPage),
  },
  {
    path: 'profile', loadComponent: () => import('./auth/profile.page').then(m => m.ProfilePage),
  },
  { path: 'login', loadComponent: () => import('./auth/account.page').then(m => m.AccountPage), data: { registro: false } },
  { path: 'register', loadComponent: () => import('./auth/account.page').then(m => m.AccountPage), data: { registro: true } },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
