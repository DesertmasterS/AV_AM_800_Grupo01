# Detección de movimiento para SafeAlert Android

La opción de Ajustes activa una sesión nativa de protección por hasta dos horas. El acelerómetro y el envío funcionan fuera de la WebView. El APK de depuración ya compila y las pruebas unitarias nativas pasan. La migración se aplicó en la base configurada el 18 de octubre de 2026. En otros entornos debe aplicarse antes de desplegar el backend. El flujo completo de movimiento con pantalla bloqueada aún requiere validación física.

## Organización

- Backend: alertas/dto/crear-alerta.dto.ts define origen y eventoId; alertas.service.ts registra y deduplica los eventos.
- Base de datos: database/migrations/20261017_movimiento_alertas.sql añade el identificador opcional y su índice único por usuario.
- Frontend: settings/settings.page muestra el consentimiento, estado y controles. settings/movimiento/motion-sos.service.ts comunica con Capacitor.
- Android: io/ionic/starter/movimiento contiene el detector, servicio, plugin, captura de ubicación, política de validez y transporte HTTP. MainActivity registra el plugin.
- Auth conserva la integración existente de JWT con Preferences y detiene el monitoreo al salir o invalidarse la sesión. La implementación no incorpora iOS.

## Flujo en Android

1. El usuario inicia sesión, abre Ajustes, acepta la sesión de protección y pulsa Activar detección.
2. El plugin solicita ubicación precisa/aproximada (se puede rechazar) y verifica el acelerómetro, las notificaciones, una sesión sincronizada y una URL absoluta HTTPS. Solo las compilaciones de depuración admiten HTTP.
3. MotionSosService inicia desde la app visible un foreground service de tipo specialUse y, con permiso disponible, location, con una notificación visible. Mantiene un bloqueo parcial de CPU durante la sesión para procesar lecturas con la pantalla apagada.
4. MotionDetector evalúa aceleración sin gravedad. Valores iniciales: 3 picos sobre 15 m/s² en 2 segundos, separados al menos 250 ms, con descenso entre picos y 30 segundos de enfriamiento.
5. Se intenta capturar una ubicación durante la prealerta de 10 segundos: vibración y notificación con Cancelar SOS. También puede cancelarse desde Ajustes. Cancelar conserva el monitoreo y cancela la captura de ubicación; Desactivar detiene ambos.
6. Al terminar la cuenta regresiva se genera un UUID v4 y se envía el evento con la ubicación disponible desde Java, sin depender de JavaScript activo. Si no hay posición válida, se omiten ambas coordenadas sin esperar más.
7. La respuesta solo se considera confirmada si el backend devuelve un estado 2xx con id de alerta válido. La notificación distingue registro confirmado de envío pendiente; no afirma que contactos o autoridades recibieron ayuda.

El detector no determina si hubo una agresión o un accidente. El umbral inicial debe calibrarse con pruebas de bolsillo, mochila, marcha, carrera y transporte. La primera versión no reproduce una sirena ni graba audio. La ubicación puede ser precisa o aproximada según el permiso concedido y la disponibilidad del dispositivo; no se garantiza una posición en interiores o en los primeros segundos de encendido del GPS.

La sesión termina a las dos horas o al vencer el JWT, lo que ocurra primero. Puede detenerse desde Ajustes o desde la notificación. No hay inicio automático tras reiniciar el teléfono ni servicio START_STICKY. Quitar la app de recientes no equivale necesariamente a forzar su cierre; el comportamiento debe comprobarse por fabricante.

## Sesión y permisos

El acelerómetro normal no requiere permiso de ubicación, micrófono, accesibilidad ni actividad física. La función solicita ubicación y notificaciones al usuario y exige un canal habilitado para que la cancelación resulte accesible. Esta es una decisión de SafeAlert: Android permite iniciar un foreground service sin conceder POST_NOTIFICATIONS, pero la app no lo hace.

La ubicación se pide conjuntamente con ACCESS_COARSE_LOCATION y ACCESS_FINE_LOCATION para respetar la elección aproximada de Android. Si se rechaza, el monitoreo sigue disponible y sus SOS salen sin coordenadas. Un permiso rechazado permanentemente debe cambiarse desde Ajustes de Android; después hay que desactivar y reactivar la detección. No se pide ACCESS_BACKGROUND_LOCATION en este flujo: el servicio de ubicación debe iniciarse desde una actividad visible, antes de bloquear la pantalla. El permiso de segundo plano ya presente en el manifiesto pertenece a la configuración previa.

Si Android impide iniciar el tipo location (por ejemplo, una revocación o ubicación deshabilitada), se intenta conservar el monitoreo specialUse sin ubicación y se muestra el aviso. Para habilitar ubicación en esa sesión se deben revisar GPS/permisos y volver a activar la detección. Si tampoco puede iniciarse specialUse, se informa que el monitoreo no pudo comenzar.

El manifiesto declara FOREGROUND_SERVICE_SPECIAL_USE y el subtipo explicativo. La publicación en Google Play necesita justificar este uso; declararlo no garantiza su aprobación. No se solicita ignorar las optimizaciones de batería.

El token llega del flujo de autenticación actual y se transmite mediante Authorization Bearer. El plugin comprueba que el usuario y la expiración declarados coincidan con la sesión local; la firma y autorización se validan en el backend. Al desaparecer o cambiar jwt_token, el servicio se detiene y descarta eventos pendientes. Las preferencias de sesión y movimiento se excluyen de copia de seguridad y transferencia entre dispositivos.

Una petición que ya llegó al servidor puede haberse registrado aunque se desactive el monitoreo durante el envío. La cancelación de la prealerta opera antes de iniciar esa petición.

## Captura de ubicación

MotionLocationCapture utiliza LocationManager (GPS y red), sin añadir dependencias de Google Play Services. Solo solicita actualizaciones durante la prealerta: no rastrea durante las dos horas de monitoreo. Se detiene al enviar, cancelar, desactivar o destruir el servicio. Una caché reciente también puede servir; se comprueba su edad con el reloj monotónico del dispositivo.

MotionLocationPolicy exige coordenadas finitas y dentro de sus rangos, edad entre 0 y 30 segundos y precisión declarada mayor que 0 y hasta 5000 metros, permitiendo ubicación aproximada. Entre posiciones válidas se elige la de menor radio de error. El backend actual conserva latitud/longitud; no guarda aún el radio de precisión ni la hora de captura como campos separados, por lo que estas coordenadas no deben presentarse como una posición exacta garantizada.

No se añade una espera después de los 10 segundos. GPS apagado, proveedor ausente, permiso denegado/revocado o una ubicación demasiado antigua producen un SOS sin coordenadas; nunca una ubicación de ejemplo. Antes de confirmar el evento se comprueba nuevamente el permiso. Los reintentos usan la posición original del evento, no consultan otra nueva.

## Contrato del backend

POST /alerta requiere la sesión existente y admite:

```json
{
  "origen": "MOVIMIENTO",
  "eventoId": "d10f34b5-1678-41cd-9a14-36b686a62745",
  "notificarPolicia": false,
  "latitud": -33.45,
  "longitud": -70.66
}
```

origen acepta BOTON, MOVIMIENTO o VOLUMEN y por defecto es BOTON. eventoId es obligatorio y UUID v4 para MOVIMIENTO. Si se incluyen coordenadas, deben ser una pareja válida; si faltan ambas, se guardan como NULL.

La respuesta conserva id, alertaId y usuarioId, y añade origen, eventoId y duplicada. Los reintentos devuelven el mismo id. El índice único usuario_id + evento_id cubre solicitudes concurrentes y varias instancias del backend. No enviar un usuario_id desde el cliente.

La misma cuenta puede reutilizar el UUID para reintentar su evento, pero otra cuenta no obtiene su alerta. El historial se filtra por el usuario autenticado y no carga perfiles de otros usuarios.

El servicio Android reintenta fallos de red, 408, 429 y 5xx con el mismo UUID, hasta 8 intentos y durante una ventana de 5 minutos. Un 401 o 403 detiene la detección. Otros errores 4xx dejan un aviso de integración sin afirmar que el SOS fue registrado.

Solo el evento cuya cuenta regresiva terminó se conserva en preferencias privadas. Si el proceso se pierde, podrá recuperarse al reactivar manualmente con el mismo usuario y backend dentro de esa ventana. Al desactivar o cambiar de cuenta se descarta. Las coordenadas de ese evento se conservan junto a su UUID para que los reintentos mantengan el mismo contenido, incluso tras una recuperación manual. Se borran al confirmar, descartar, desactivar o cambiar de cuenta. No se guardan lecturas crudas del sensor ni recorridos.

## Preparación antes de desplegar

1. Aplicar database/migrations/20261017_movimiento_alertas.sql en la base correspondiente. synchronize continúa desactivado. El 18 de octubre de 2026 se aplicó en la base configurada para el proyecto: se verificaron evento_id y el índice único, sin modificar alertas existentes. Un EXPLAIN validó la estructura de inserción sin ejecutar el INSERT. La consulta autenticada GET /alerta/historial a Cloud Run devolvió HTTP 200 tras la migración; no se creó ninguna alerta de prueba.
2. Desplegar el backend con el DTO y servicio nuevos. Si se despliega el código sin la columna evento_id, las operaciones de alertas fallarán al consultar o guardar.
3. Verificar JWT_SECRET, HTTPS y la URL de environment.apiUrl. El móvil necesita una dirección alcanzable; localhost del equipo no sirve como backend del teléfono.
4. Ejecutar npm run build y npx cap sync android en SafeAlert-frontend.
5. Configurar un JDK compatible con Capacitor 8 y el Android SDK indicado por el proyecto. Ejecutar gradlew.bat :app:testDebugUnitTest :app:assembleDebug en android.

La detección no se activa por la simple presencia de los permisos del manifiesto. Debe solicitarla el usuario desde la aplicación visible.

## Verificación

Las pruebas del backend cubren DTOs, asociación de usuario, ausencia de GPS, coordenadas válidas y conservación de ubicación en reintentos, idempotencia, concurrencia e historial privado. Las pruebas del frontend cubren el contrato del plugin, rechazo fuera de Android, permisos rechazados, cancelación y sincronización de sesión.

Se incluyen pruebas JUnit del detector y de la política de ubicación (precisa/aproximada, caducada, futura e inválida) en android/app/src/test/java/io/ionic/starter/movimiento. El 17 de octubre de 2026 se ejecutó gradlew.bat :app:testDebugUnitTest :app:assembleDebug con resultado BUILD SUCCESSFUL: 7 pruebas, sin fallos ni errores (3 del detector, 3 de ubicación y 1 de ejemplo). El APK está en android/app/build/outputs/apk/debug/app-debug.apk.

Este equipo tiene Temurin JDK 21.0.12.1, Android SDK Platform 36, Build Tools 35.0.0 y 36.0.0, Platform Tools con ADB y Command-line Tools. JAVA_HOME, ANDROID_HOME y el PATH están configurados para el usuario de Windows. Las rutas específicas del equipo se guardan en android/local.properties y android/.gradle/config.properties, ambos ignorados por Git. Las terminales abiertas antes de la instalación deben reiniciarse para recibir las variables nuevas. ADB se verificó y no había dispositivos conectados durante esta comprobación.

Antes de dar por validado el funcionamiento: probar con pantalla bloqueada, ahorro de batería, app en recientes y cierre forzado; cancelar desde la notificación; cambiar y cerrar sesión; perder y recuperar red; repetir un evento y verificar un solo registro en PostgreSQL. Probar también permiso preciso/aproximado/denegado, GPS apagado, ubicación antigua, revocación, cancelación mientras se busca posición y conservación de coordenadas durante reintentos sin red. Medir batería, falsos positivos y disponibilidad de sensores. No se hicieron envíos reales de emergencia durante esta implementación.

## Referencias de plataforma

- [Permisos de ubicación y pantalla apagada](https://developer.android.com/develop/sensors-and-location/location/permissions)
- [LocationManager](https://developer.android.com/reference/android/location/LocationManager)
- [Sensores de Android](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview)
- [Tipos de foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [Permiso de notificaciones](https://developer.android.com/develop/ui/compose/notifications/notification-permission)
- [Plugins Android de Capacitor](https://capacitorjs.com/docs/plugins/android)
