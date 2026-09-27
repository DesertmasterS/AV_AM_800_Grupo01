# SafeAlert - Sistema de Notificación y Gestión de Emergencias

Aplicación compuesta por un Frontend móvil/web desarrollado en **Ionic/Angular** y un Backend REST API en **NestJS** conectado a una base de datos PostgreSQL en la nube (**Neon.tech**).

---

## Requisitos Previos

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.
* [Git](https://git-scm.com/) para clonar el repositorio.

---

## Despliegue con Docker

### 1. Configuración de Variables de Entorno
Copia la plantilla de variables de entorno y completa con las credenciales de la base de datos Neon:
```bash
cp SafeAlert-backend/.env.example SafeAlert-backend/.env
```
Edita el archivo `SafeAlert-backend/.env` con los datos correspondientes de tu instancia de PostgreSQL.

### 2. Construir y Levantar los Contenedores
Desde la raíz del proyecto, ejecuta:
```bash
docker compose up --build
```
> Si deseas levantarlo en segundo plano, añade el flag `-d`: `docker compose up --build -d`

### 3. Acceso a los Servicios
Una vez que Docker finalice la compilación y arranque de los servicios:
* **Frontend (Ionic/Angular):** [http://localhost:8100](http://localhost:8100)
* **Backend API (NestJS):** [http://localhost:3000](http://localhost:3000)
* **Prueba de Inserción (Alerta):** Presionar el botón `S.O.S` en la aplicación web para registrar una alerta en Neon.tech.

### 4. Detener el Sistema
Para detener todos los contenedores y redes creadas:
```bash
docker compose down
```