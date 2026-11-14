import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ActualizarContactoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'El teléfono debe tener formato internacional E.164 (ej: +56912345678)' })
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  relacion?: string | null;

  @IsOptional()
  @IsBoolean()
  notificarActivo?: boolean;
}