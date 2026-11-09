export interface ContactoEmergencia {
  id: number;
  nombre: string;
  telefono: string;
  relacion: string | null;
  confirmado?: boolean;
  rechazado?: boolean;
  notificarActivo?: boolean;
  creadoEn?: string;
}

export interface ContactoRequest {
  nombre?: string;
  telefono?: string;
  relacion?: string | null;
  notificarActivo?: boolean;
}

export interface ContactosResponse { contactos: ContactoEmergencia[]; }
export interface ContactoResponse { contacto: ContactoEmergencia; }