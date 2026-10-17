-- Ejecutar antes de desplegar el backend con soporte de movimiento.
-- No se ejecuta automáticamente. No modifica las alertas existentes.
BEGIN;
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS evento_id uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_alertas_usuario_evento
  ON alertas (usuario_id, evento_id) WHERE evento_id IS NOT NULL;
COMMIT;
