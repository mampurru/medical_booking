const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection } = require('./src/config/db');
const routes = require('./src/routes');
const errorHandler = require('./src/middleware/error');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
//app.use(helmet());
// app.use(cors({
//   origin: 'http://localhost:3000',
//   credentials: true
// }));
// Middlewares
app.use(helmet());

// CORS dinámico para desarrollo y producción
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://medical-booking.vercel.app',
  'https://medical-booking-git-main-mampurru.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'CORS policy: Origen no permitido: ' + origin;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api', routes);

// Manejo de errores
app.use(errorHandler);

// Iniciar servidor
const startServer = async () => {
  try {
    await testConnection();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📝 Modo: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();