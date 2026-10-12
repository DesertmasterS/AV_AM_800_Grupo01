import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  apellido: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'El teléfono debe cumplir con el formato internacional E.164 (ej: +56912345678)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s\-\(\)]/g, '') : value,
  )
  telefono: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password: string; // Sin trim para respetar espacios intencionales
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UsuarioPublicoDto {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
}