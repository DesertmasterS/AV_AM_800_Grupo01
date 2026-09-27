# 1. Imagen base oficial ligera de Node versión 24 (alpine)
FROM node:24-alpine

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código fuente
COPY . .

# Compilar NestJS a JavaScript puro (carpeta dist)
RUN npm run build

# Exponer el puerto del backend
EXPOSE 3000

# Comando para iniciar la aplicación en modo producción
CMD ["node", "dist/main.js"]