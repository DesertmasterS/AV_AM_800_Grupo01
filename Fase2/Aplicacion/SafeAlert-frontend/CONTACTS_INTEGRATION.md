# Integración de contactos de emergencia

La ruta /emergency-contacts incluye listado, búsqueda, creación, edición y eliminación con confirmación. ContactsService conecta cada operación al servidor; el listado cambia cuando llega una respuesta exitosa.

## Contrato propuesto

La URL base procede de environment.apiUrl y utiliza el mismo mecanismo de sesión con cookies que AuthService. Implementar estos endpoints en NestJS:

| Método | Endpoint | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET | /contactos-emergencia | Cookie de sesión | 200 con { contactos: ContactoEmergencia[] } |
| POST | /contactos-emergencia | ContactoRequest | 201 con { contacto: ContactoEmergencia } |
| PATCH | /contactos-emergencia/:id | ContactoRequest completo | 200 con { contacto: ContactoEmergencia } |
| DELETE | /contactos-emergencia/:id | Cookie de sesión | 204 sin cuerpo |

ContactoRequest contiene nombre, telefono y relacion. ContactoEmergencia añade id numérico y creadoEn opcional como fecha ISO. Los tipos están en src/app/contacts/contacts.models.ts.

El cliente recorta nombre y relación, elimina espacios, guiones y paréntesis del teléfono y envía null si la relación está vacía. Nombre y teléfono son obligatorios: nombre entre 2 y 100 caracteres y teléfono internacional E.164 con signo + y hasta 15 dígitos. La relación es opcional y admite hasta 50 caracteres.

## Conexión con la entidad existente

La entidad ContactoEmergencia del backend ya contiene id, nombre, telefono, relacion, usuario y creadoEn. Mantener esos nombres al producir el DTO público y excluir usuario del cuerpo de respuesta. Obtener el usuario de la sesión autenticada y asignarlo en el servidor. El cliente nunca envía usuario_id.

Restringir todas las consultas y modificaciones al usuario autenticado. Una persona no debe poder consultar, editar ni eliminar contactos ajenos cambiando el id. Validar DTOs en el servidor y establecer una restricción de unicidad por usuario y teléfono normalizado; el mismo teléfono puede pertenecer a cuentas distintas.

Devolver 401 sin sesión, 400 para datos inválidos, 409 para un teléfono repetido y 404 cuando un contacto no existe o no pertenece al usuario. Los errores de red, timeout o servicio ausente conservan el formulario para reintentar. Ante un 401 se limpia el listado y se ofrece inicio de sesión.

La configuración de cookies, CORS, HTTPS, proxy /api y protección CSRF sigue el contrato descrito en AUTH_INTEGRATION.md. Estos endpoints todavía no existen en el backend inspeccionado.

## Ejemplo visual

El botón Explorar un ejemplo muestra tres contactos ficticios. En ese modo, crear, editar y eliminar solo modifican la memoria de la vista: no hay peticiones de escritura, almacenamiento local ni sincronización posterior. Ver mi cuenta descarta el ejemplo y vuelve a consultar al servidor. Recargar también descarta esos datos.

El módulo gestiona los contactos; no envía mensajes de emergencia ni afirma que alguien fue notificado. Esa integración corresponde al flujo de alertas.

## Verificación pendiente con backend

- Comprobar listado vacío y listado con contactos de una sesión real.
- Crear y editar un contacto; recargar y verificar que los cambios persisten.
- Confirmar y cancelar eliminaciones; verificar que se elimina solo el registro elegido.
- Probar teléfono duplicado, sesión expirada y fallos de red.
- Verificar autorización por usuario y ausencia de datos de otras cuentas.
