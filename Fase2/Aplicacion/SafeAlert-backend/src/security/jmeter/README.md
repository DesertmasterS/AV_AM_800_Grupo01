# Pruebas locales con Apache JMeter

JMeter 5.6.3 está instalado en `%LOCALAPPDATA%\Programs\Apache\apache-jmeter-5.6.3`.
Se descargó el ZIP oficial de Apache y se verificó contra su SHA-512 publicado.
Java 21 ya está instalado. No se requieren plugins ni nuevas dependencias npm.

## Ejecutar

Desde `SafeAlert-backend`, con las dependencias del backend y del laboratorio ZAP
(`src/security/zap/runtime`) instaladas:

```powershell
npm run build
# Terminal 1: datos en memoria, desaparecen al detener el proceso
node src/security/jmeter/start-local.cjs
# Terminal 2: prueba de humo (10 segundos)
node src/security/jmeter/run-load.cjs --smoke
# Serie completa: 1/5/10/25 usuarios, 10/45/60/60 segundos
node src/security/jmeter/run-load.cjs
```

El ejecutor usa el JDK instalado en `Programs/EclipseAdoptium/temurin-21/jdk-21.0.12.1+1`.
Si se cambia su instalación, actualizar la ruta `java` del ejecutor.
Los resultados se guardan en `output/FECHA/ID/Informe-SafeAlert-JMeter.html`,
junto con el panel HTML nativo de cada escenario, CSV JTL, logs, métricas del
laboratorio, copia del plan y resultados JSON. Esa carpeta está excluida de Git.

Para inspeccionar el plan en la interfaz de JMeter, abrir `bin/jmeter.bat` y cargar
`SafeAlert-carga-local.jmx`. Ejecutar la carga por CLI, como hace el ejecutor,
evita el consumo de los gráficos y listeners de la interfaz.

## Aislamiento y alcance

- Destino fijo `http://127.0.0.1:4400`. La preparación exige el perfil de laboratorio.
- PostgreSQL PGlite en memoria, puerto 54349, pool de una conexión. No usa Neon.
- Cincuenta cuentas sintéticas, con sesión/cookies separadas por hilo.
- Green API sin credenciales y `fetch` externo bloqueado. No se envía WhatsApp.
- Controladores, validación, autenticación, servicios y entidades reales del backend.
- Una sola alerta por cuenta en cada ciclo. Coordenadas ficticias cerca de 0,0.
- Comprueba perfil, contactos, creación, actualización, seguimiento, finalización e historial.
- Pausa de 200 ms antes de cada petición, incluida la preparación de cada hilo.
- Se detiene el aumento de carga si hay cualquier muestra fallida, no se completa
  ningún SOS o el P95 supera 5 segundos. Es una guarda del ensayo, no un SLA.
- Los hilos pueden terminar con una alerta sintética activa al acabar su tiempo.
  La siguiente etapa la finaliza antes de medir; detener el laboratorio elimina todo.
- No se mide envío real de mensajes, Android, sensores, red móvil ni renderizado web.

Los percentiles del resumen usan rango más cercano sobre operaciones `CARGA`;
la columna de errores totales también incluye `SETUP`. El panel nativo de JMeter
incluye todas las etiquetas. La duración incluye la rampa de incorporación.
El historial sintético crece entre etapas y no se reinicia la base entre escenarios.

JMeter y el backend comparten PC y PGlite solo permite una conexión en este ensayo:
los resultados sirven de referencia funcional bajo concurrencia, **no permiten
afirmar cuántos usuarios soporta Cloud Run/Neon**. Para medir producción se necesita
otro entorno autorizado con PostgreSQL comparable, generador separado, tamaño de
datos representativo, SLA acordado y servicios externos controlados.

No se despliega ni se hace commit o merge al ejecutar estas herramientas.

Fuentes de instalación y uso:
- https://jmeter.apache.org/download_jmeter.cgi
- https://jmeter.apache.org/usermanual/get-started.html
