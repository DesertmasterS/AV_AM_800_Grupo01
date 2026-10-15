import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarContactoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  relacion?: string | null;
}