import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class CrearAlertaDto {
  @IsNumber()
  @IsOptional()
  latitud?: number;

  @IsNumber()
  @IsOptional()
  longitud?: number;

  @IsBoolean()
  @IsOptional()
  notificarPolicia?: boolean;
}