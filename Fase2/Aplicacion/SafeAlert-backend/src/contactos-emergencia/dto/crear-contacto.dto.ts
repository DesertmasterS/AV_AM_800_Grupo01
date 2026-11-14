import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CrearContactoDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString()
  @MaxLength(16)
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'El teléfono debe tener formato internacional E.164 (ej: +56912345678)' })
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value)
  telefono: string;

  @IsOptional() // Permite undefined y null
  @IsString()
  @MaxLength(50)
  relacion?: string | null;
}