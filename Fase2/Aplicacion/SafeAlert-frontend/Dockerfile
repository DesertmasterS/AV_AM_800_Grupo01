# ETAPA 1: Construcción con Node 24 
FROM node:24-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Compila la aplicación web (genera la carpeta www)
RUN npm run build

# ETAPA 2: Servidor Web de Producción (Nginx)
FROM nginx:alpine

# Copiar configuración personalizada para SPA (Angular Routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos estáticos compilados de Ionic al directorio de Nginx
COPY --from=build /app/www /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]