const express = require('express');
const router = express.Router();
const appointmentsController = require('../controllers/appointments');
const { verifyTokenMiddleware, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(verifyTokenMiddleware);

// GET - Obtener citas (con filtros)
router.get('/', appointmentsController.getAppointments);

// GET - Obtener disponibilidad de un médico
router.get('/availability', appointmentsController.getDoctorAvailability);

// GET - Obtener cita por ID
router.get('/:id', appointmentsController.getAppointmentById);

// POST - Crear nueva cita
router.post('/', 
  authorize('patient', 'doctor', 'admin'), 
  appointmentsController.createAppointment
);

// PUT - Actualizar cita (parcial)
router.put('/:id', 
  authorize('patient', 'doctor', 'admin'), 
  appointmentsController.updateAppointment
);

// PUT - Cancelar cita
router.put('/:id/cancel', 
  authorize('patient', 'doctor', 'admin'), 
  appointmentsController.cancelAppointment
);

// PUT - Reprogramar cita
router.put('/:id/reschedule', 
  authorize('doctor', 'admin'), 
  appointmentsController.rescheduleAppointment
);

// DELETE - Eliminar cita (solo admin)
router.delete('/:id', 
  authorize('admin'), 
  appointmentsController.deleteAppointment
);

module.exports = router;