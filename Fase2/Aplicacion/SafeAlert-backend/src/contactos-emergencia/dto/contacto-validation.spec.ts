import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearContactoDto } from './crear-contacto.dto';
import { ActualizarContactoDto } from './actualizar-contacto.dto';

for (const dto of [CrearContactoDto, ActualizarContactoDto]) {
  describe(dto.name, () => {
    it.each(['contactos-emergencia', '../etc/passwd', 'no-es-un-telefono', '1234567890123456789012345', '', '+01234567'])('rechaza teléfono inválido: %s', async telefono => {
      const errors = await validate(plainToInstance(dto as typeof CrearContactoDto, { nombre: 'Prueba', telefono }));
      expect(errors.some(error => error.property === 'telefono')).toBe(true);
    });
    it('normaliza separadores conservando el formato E.164', async () => {
      const data = plainToInstance(dto as typeof CrearContactoDto, { nombre: 'Prueba', telefono: '+56 (9) 1234-5678' });
      expect(await validate(data)).toHaveLength(0);
      expect(data.telefono).toBe('+56912345678');
    });
  });
}
