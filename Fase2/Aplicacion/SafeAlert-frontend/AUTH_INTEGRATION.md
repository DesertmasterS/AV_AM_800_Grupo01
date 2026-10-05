# Integración de cuentas de SafeAlert

El frontend incluye Perfil, Inicio de sesión y Registro. Los formularios llaman al backend real mediante AuthService; no crean cuentas simuladas ni almacenan claves en el navegador. La autenticación del backend aún debe implementarse.

## Rutas y archivos

- /profile muestra los datos devueltos por el servidor o el acceso a la cuenta.
- /login solicita correo y clave.
- /register solicita nombre, apellido, teléfono, correo y clave.
- src/app/auth/auth.models.ts define los DTOs.
- src/app/auth/auth.service.ts concentra las llamadas HTTP y el estado de sesión.
- src/environments/environment.ts configura la URL de desarrollo, actualmente http://localhost:3000.
- src/environments/environment.prod.ts usa /api. Antes de desplegar, configurar el proxy del servidor web para reenviar /api al backend; el nginx.conf actual no contiene ese proxy.

## Contrato propuesto para NestJS

Implementar los siguientes endpoints bajo /auth. Registro e inicio de sesión deben establecer una cookie de sesión y devolver el mismo formato de usuario.

| Método | Endpoint | Entrada | Respuesta |
| --- | --- | --- | --- |
| POST | /auth/register | nombre, apellido, telefono, email, password | 201 con { usuario } |
| POST | /auth/login | email, password | 200 con { usuario } |
| GET | /auth/me | Cookie de sesión | 200 con { usuario }; 401 sin sesión |
| POST | /auth/logout | {} y cookie de sesión | 204, sesión invalidada y cookie eliminada |

El objeto usuario debe contener id numérico, nombre, apellido, telefono y email. No incluir password ni passwordHash. Registro inicia sesión automáticamente según este contrato.

Ejemplo de cuerpo de registro con datos ficticios:

```json
{
  "nombre": "Nombre",
  "apellido": "Apellido",
  "telefono": "+56912345678",
  "email": "demo@example.test",
  "password": "clave-de-prueba"
}
```

El cliente recorta nombre y apellido, normaliza el correo a minúsculas y elimina espacios, guiones y paréntesis del teléfono. La clave se envía sin recortarla. Todos los campos son obligatorios: nombres de 2 a 100 caracteres, correo de hasta 150, teléfono en formato internacional E.164 y clave de 8 a 128 caracteres. Aplicar también estas validaciones en los DTOs del backend.

## Cambios pendientes en la base de datos

La entidad actual Usuario en SafeAlert-backend/src/database/entities/usuario.entity.ts contiene nombre, telefono y email, pero no apellido ni credenciales.

Agregar apellido con longitud 100 y passwordHash con select: false. Guardar un hash de la clave calculado por el backend, nunca la clave original. Mantener la unicidad del correo y normalizarlo antes de consultar o guardar. Crear una migración explícita y definir cómo completar apellido y credenciales de usuarios existentes; no inventar claves para esos registros. Generar la respuesta pública mediante un DTO, sin serializar la entidad completa.

Si se utiliza una sesión persistente, agregar el almacenamiento de sesiones o integrar el gestor de sesiones elegido. Asociar las operaciones protegidas al usuario de la sesión, sin confiar en un id enviado por el cliente.

## Sesión y errores

El cliente usa withCredentials: true y conserva únicamente el usuario en memoria. Al entrar a Perfil consulta /auth/me, por lo que una sesión válida puede recuperarse después de recargar. Un 401 elimina el usuario; un fallo de red o del servicio muestra un aviso. Al cerrar sesión, el estado local solo se elimina tras la confirmación del servidor.

Configurar cookies HttpOnly, SameSite según el despliegue y Secure en producción con HTTPS. Para desarrollo con frontend y backend en puertos diferentes, habilitar CORS con el origen exacto del frontend y credentials: true. Usar el mismo nombre de host en ambos servicios, por ejemplo localhost. En producción se propone el proxy /api en el mismo origen.

Implementar protección CSRF para las operaciones que usan cookies, validación del origen y limitación de intentos de autenticación en el servidor. Si se adopta el esquema XSRF de Angular, emitir la cookie XSRF-TOKEN y validar X-XSRF-TOKEN en las peticiones del mismo origen. El backend debe aplicar la protección elegida también en desarrollo; el cliente no adjunta automáticamente ese encabezado a la URL absoluta de otro origen.

El frontend distingue 400 para datos inválidos, 401 para credenciales incorrectas o sesión ausente, 409 para correo duplicado y 429 para exceso de intentos. Fallos de red, timeout o endpoints todavía ausentes muestran un mensaje de servicio no disponible. No mostrar al usuario detalles internos de la base de datos.

## Comprobación de la integración

La vista previa usa prebundle: false en angular.json para evitar un error de renderizado de los componentes Ionic durante la precompilación de dependencias del servidor de desarrollo. La compilación de producción mantiene su optimización.

1. Crear una cuenta y verificar que la respuesta y cookie coinciden con el contrato.
2. Comprobar que Perfil muestra nombre, apellido, teléfono y correo.
3. Recargar Perfil y confirmar que /auth/me restaura la sesión.
4. Cerrar sesión y confirmar que la cookie queda invalidada.
5. Verificar correo duplicado, credenciales incorrectas y sesión expirada.
6. Confirmar que ninguna respuesta, log ni almacenamiento del navegador contiene claves o hashes.

El registro, recuperación de clave, verificación de correo y edición de datos requieren trabajo del backend. La recuperación y edición no están implementadas en este cambio.
