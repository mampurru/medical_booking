const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth');
const appointmentRoutes = require('./appointments');
const doctorRoutes = require('./doctors'); // ← AGREGA ESTA LÍNEA
const adminRoutes = require('./admin');
console.log('📌 adminRoutes:', adminRoutes);

// Usar rutas
router.use('/auth', authRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes); // ← AGREGA ESTA LÍNEA
router.use('/admin', adminRoutes);

// Ruta de prueba
router.get('/', (req, res) => {
  res.json({ 
    message: 'API Medical Booking - Funcionando correctamente',
    version: '1.0.0'
  });
});

module.exports = router;