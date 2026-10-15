import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearContactoDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @IsString()
  telefono: string;

  @IsOptional() // Permite undefined y null
  @IsString()
  @MaxLength(50)
  relacion?: string | null;
}