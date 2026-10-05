/** DTOs propuestos para el módulo de autenticación NestJS. */
export interface RegistroRequest {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  password: string;
}
export interface LoginRequest { email: string; password: string; }
/** El servidor nunca debe incluir password ni passwordHash en esta respuesta. */
export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
}
export interface SesionResponse { usuario: UsuarioSesion; }
