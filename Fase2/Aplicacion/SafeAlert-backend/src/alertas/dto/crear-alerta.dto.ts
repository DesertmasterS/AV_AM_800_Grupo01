import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export enum OrigenAlerta {
  BOTON = 'BOTON',
  MOVIMIENTO = 'MOVIMIENTO',
  VOLUMEN = 'VOLUMEN',
}

export class CrearAlertaDto {
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