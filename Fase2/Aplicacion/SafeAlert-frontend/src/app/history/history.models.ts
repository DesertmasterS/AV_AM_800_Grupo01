export interface AlertaHistorial {
  id: number;
  tipo: string;
  eventoId?: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  fecha: string;
}

export type HistorialResponse = AlertaHistorial[] | { alertas: AlertaHistorial[] };