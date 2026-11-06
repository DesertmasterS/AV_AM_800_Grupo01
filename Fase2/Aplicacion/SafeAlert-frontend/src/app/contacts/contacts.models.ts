export interface ContactoEmergencia {
  id: number;
  nombre: string;
  telefono: string;
  relacion: string | null;
  confirmado?: boolean;
  rechazado?: boolean;
  creadoEn?: string;
}
export interface ContactoRequest {
  nombre: string;
  telefono: string;
  relacion: string | null;
}
export interface ContactosResponse { contactos: ContactoEmergencia[]; }
export interface ContactoResponse { contacto: ContactoEmergencia; }
