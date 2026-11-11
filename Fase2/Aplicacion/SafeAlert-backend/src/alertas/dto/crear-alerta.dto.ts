import { IsEnum, IsInt, Min, Max, IsLatitude, IsLongitude, IsNumber, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export enum OrigenAlerta {
  BOTON = 'BOTON',
  MOVIMIENTO = 'MOVIMIENTO',
  VOLUMEN = 'VOLUMEN',
}

export class CrearAlertaDto {
  // Porcentaje del dispositivo emisor al enviar el SOS; no es una medición en vivo.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bateriaPorcentaje?: number;

  @IsLatitude()
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsLongitude()
  @IsNumber()
  @IsOptional()
  longitud?: number;

  @IsEnum(OrigenAlerta)
  @IsOptional()
  origen?: OrigenAlerta;

  @ValidateIf((dto: CrearAlertaDto) => dto.origen === OrigenAlerta.MOVIMIENTO || dto.eventoId !== undefined)
  @IsUUID('4')
  eventoId?: string;
}