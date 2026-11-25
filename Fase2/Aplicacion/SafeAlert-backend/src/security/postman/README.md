# Integración HTTP con Postman

Colección: `SafeAlert-integracion.postman_collection.json` (Postman v2.1).
Generador sin dependencias: `node src/security/postman/build-collection.cjs`.

Desde la carpeta del backend:

```powershell
npm run build
node src/security/postman/start-local.cjs
```

Importar la colección en Postman y ejecutarla completa, en orden, con el runner
**Functional**, método **Local**, una iteración. Seleccionar **Run collection
without using stored cookies** y desmarcar **Save cookies after collection run**.
Cada petición también tiene `disableCookies: true`: se envía explícitamente la
cookie de la cuenta A o B cuando corresponde. No se requiere un environment.

El destino está fijado en `http://127.0.0.1:4500`. La primera petición comprueba
el perfil aislado y crea identificadores únicos para la ejecución. Se puede repetir
la colección; crea nuevas cuentas sintéticas en cada ocasión. No ejecutar una
petición intermedia sin haber preparado sus variables con los pasos anteriores.

## Qué integra

- NestJS, controladores, DTO/ValidationPipe, JWT/cookie y servicios reales compilados.
- Entidades TypeORM reales sobre PostgreSQL PGlite en memoria (puerto 54359).
- Registro, sesión, perfil, datos inválidos, correo duplicado y clave incorrecta.
- Contactos: crear, normalizar teléfono, duplicados, confirmar mediante enlace,
  editar, desactivar notificaciones, eliminar y comprobar persistencia.
- Rechazo de reenvío de invitación antes de 48 horas.
- SOS: botón, movimiento y volumen enviados por HTTP; batería opcional y validación.
- Idempotencia, una sola alerta activa, ubicación, seguimiento e historial.
- Aislamiento entre cuentas: B no puede modificar contactos ni alertas de A.
- Coordenadas públicas ocultas al finalizar la alerta.
- Cierre de sesión: cookie expirada y rechazo de solicitudes posteriores sin cookie.
  No se afirma revocación del JWT; ese comportamiento no lo implementa el logout.

## Mensajería y límites

`lab-fixtures.cjs` registra un receptor HTTP **simulado** de Green API dentro del
laboratorio. Usa credenciales ficticias y solo acepta números sintéticos que
comienzan con `5690000`. Los mensajes quedan en `/__lab/outbox`; no salen a Internet.
La colección comprueba invitación, UUID, destinatario, batería y coordenadas en el
texto preparado por los servicios reales. El enlace de invitación se usa para
extraer su token y probar la ruta del backend directamente; no se prueba el proxy
`/api` del frontend. No se asegura entrega real a WhatsApp.

Las credenciales reales del proveedor se reemplazan en memoria y el `fetch` del
servidor solo permite el origen local del laboratorio. La base de datos y mensajes
desaparecen al detener el proceso (Ctrl+C). No se conecta a Neon ni a Cloud Run.
Las cuentas de prueba no se eliminan mediante una API de usuario, porque no existe
tal endpoint; son efímeras en memoria.

El proceso del laboratorio usa `TZ=UTC`, alineado con PGlite. En el primer ensayo
completo, ejecutar Node en America/Santiago e interpretar `creado_en` (timestamp
sin zona) como hora local produjo un aviso de 51 h en vez de 48 h. Se conserva la
comprobación estricta de 48 h; se corrigió únicamente la configuración temporal
del laboratorio. No se afirma haber validado la zona horaria de producción.

Estas pruebas no cubren sensores Android, pantalla apagada, widget, permisos,
captura GPS física, red móvil, interfaz del frontend ni una espera real de 48 horas.
No cambian lógica funcional de la aplicación, ni ejecutan commit, merge o despliegue.

La carpeta `output/` guarda evidencias y exportaciones de ejecuciones y está
excluida de Git. Las herramientas Postman se excluyen del contexto Docker.
