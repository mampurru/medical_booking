# Usar Node.js LTS
FROM node:18-alpine

# Working directory
WORKDIR /app

# Copiar package.json del backend
COPY backend/package*.json ./backend/

# Instalar dependencias del backend
WORKDIR /app/backend
RUN npm install --production

# Copiar el resto del código del backend
COPY backend/ ./

# Exponer puerto
EXPOSE 5000

# Comando de inicio
CMD ["node", "server.js"]