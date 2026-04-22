const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection } = require('./src/config/db');
const routes = require('./src/routes');
const errorHandler = require('./src/middleware/error');
const cron = require('node-cron');
const { sendReminders } = require('./src/services/reminderService');

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

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL,
  'https://medical-booking-plum.vercel.app',  // ← Tu dominio actual de Vercel
  'https://medical-booking.vercel.app'         // ← Dominio futuro (cuando lo cambies)
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (Postman, móvil, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy: Origen no permitido: ${origin}`;
      console.error(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
    // Health check endpoint para Railway
    app.get('/api/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV 
      });
    });
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📝 Modo: ${process.env.NODE_ENV || 'development'}`);
      // Configurar Cron Job para recordatorios (cada 15 minutos)
      cron.schedule('*/15 * * * *', () => {
        console.log('⏰ Ejecutando cron job de recordatorios...');
        sendReminders();
      });

      console.log('✅ Cron job de recordatorios configurado (cada 15 minutos)');
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();