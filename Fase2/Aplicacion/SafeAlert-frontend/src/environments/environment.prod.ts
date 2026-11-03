const isCloudRunWeb =
  typeof window !== 'undefined' &&
  window.location?.hostname?.endsWith('.run.app');

export const environment = {
  production: true,
  // Si se abre desde el navegador en Cloud Run (.run.app), usa el proxy '/api' del mismo dominio.
  // Si corre dentro de la APK de Android (Capacitor), usa la URL HTTPS directa para que Java valide la URI.
  apiUrl: isCloudRunWeb
    ? '/api'
    : 'https://safealert-api-299712175128.southamerica-west1.run.app',
};