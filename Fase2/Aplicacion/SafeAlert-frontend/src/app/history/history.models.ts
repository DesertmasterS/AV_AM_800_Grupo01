export interface AlertaHistorial {
  id: number;
  tipo: string;
  eventoId?: string | null;
  latitud: number | null;
  longitud: number | null;
  estado: string;
  mensajePoliciaEstado?: string;
  cuartel?: string | null;
  fecha: string;
}

export type HistorialResponse = AlertaHistorial[] | { alertas: AlertaHistorial[] };