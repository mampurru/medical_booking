const express = require('express');
const router = express.Router();
const appointmentsController = require('../controllers/appointments');
const { pool } = require('../config/db');
const { verifyTokenMiddleware, authorize } = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
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
// router.put('/:id/reschedule', 
//   authorize('doctor', 'admin'), 
//   appointmentsController.rescheduleAppointment
// );
// Solo admins pueden reprogramar
router.put('/:id/reschedule', 
  verifyTokenMiddleware, 
  checkRole(['super_admin', 'admin_general', 'admin_especialidad']), 
  appointmentsController.rescheduleAppointment
);

// DELETE - Eliminar cita (solo admin)
router.delete('/:id', 
  authorize(['super_admin', 'admin_general', 'admin_especialidad']), 
  appointmentsController.deleteAppointment
);

// 🛑 Doctor solicita cancelación (Requiere aprobación de Admin)
router.post('/:id/cancel-request',
  verifyTokenMiddleware,
  authorize('doctor'),
  async (req, res) => {
    console.log('📝 Solicitud de cancelación recibida');
    console.log('👨‍⚕️ Doctor ID:', doctorId);
    console.log('📋 Appointment ID:', appointment[0].id);
    const { id } = req.params;
    const { reason, cancellation_type = 'single' } = req.body;

    try {
      // 1. Validar tipo de cancelación
      if (!['single', 'full_day'].includes(cancellation_type)) {
        return res.status(400).json({ success: false, message: 'Tipo de cancelación no válido' });
      }

      // 2. Obtener doctor_id del usuario actual
      const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
      if (doctorRows.length === 0) {
        return res.status(400).json({ success: false, message: 'Usuario no asociado a un perfil de doctor' });
      }
      const doctorId = doctorRows[0].id;

      // 3. Verificar que la cita pertenece al doctor y está programada
      const [appointment] = await pool.query(
        'SELECT id, doctor_id, start_time FROM appointments WHERE id = ? AND status = "scheduled"',
        [id]
      );
      if (appointment.length === 0) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada o no está programada' });
      }
      if (appointment[0].doctor_id !== doctorId) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para cancelar esta cita' });
      }

      // 4. Si es 'full_day', buscar todas las citas del doctor para esa fecha
      const appointmentDate = new Date(appointment[0].start_time).toISOString().split('T')[0];
      let appointmentsToRequest = [];

      if (cancellation_type === 'full_day') {
        const [dayAppointments] = await pool.query(
          'SELECT id FROM appointments WHERE doctor_id = ? AND DATE(start_time) = ? AND status = "scheduled"',
          [doctorId, appointmentDate]
        );
        appointmentsToRequest = dayAppointments.map(a => a.id);
      } else {
        appointmentsToRequest = [appointment[0].id];
      }

      // 5. Insertar solicitudes en cancellation_requests
      const values = appointmentsToRequest.map(appId => [
        appId, doctorId, req.user.id, cancellation_type, reason, 'pending'
      ]);

      await pool.query(
        `INSERT INTO cancellation_requests 
         (appointment_id, doctor_id, doctor_user_id, cancellation_type, reason, status) 
         VALUES ?`,
        [values]
      );
      // 🔔 Emitir notificación (VERSIÓN DEBUG - más segura)
      try {
        console.log('📝 [DEBUG] Iniciando notificación para doctorId:', doctorId);

        // 1. Obtener info del doctor
        const [doctorInfo] = await pool.query(`
          SELECT d.id, d.specialty_id, u.first_name, u.last_name
          FROM doctors d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = ?
        `, [doctorId]);

        if (doctorInfo.length === 0) {
          console.warn('⚠️ Doctor no encontrado en BD');
          // Continuar sin notificaciones inteligentes
        }

        const doctor = doctorInfo[0] || {};
        const isSpecialist = doctor.specialty_id != null; // null o undefined
        console.log('🔍 Doctor:', doctor.first_name, '¿Especialista?', isSpecialist);

        // 2. Determinar admins a notificar
        let adminIds = [];
        
        // Siempre super_admin
        try {
          const [superAdmins] = await pool.query('SELECT id FROM users WHERE role = "super_admin"');
          adminIds.push(...superAdmins.map(a => a.id));
          console.log(`✅ Super admins: ${superAdmins.length}`);
        } catch (e) {
          console.error('❌ Error obteniendo super_admins:', e.message);
        }

        if (isSpecialist) {
          try {
            const [specialtyAdmins] = await pool.query(
              'SELECT id FROM users WHERE role = "admin_especialidad" AND specialty_id = ?',
              [doctor.specialty_id]
            );
            adminIds.push(...specialtyAdmins.map(a => a.id));
            console.log(`✅ Admins especialidad: ${specialtyAdmins.length}`);
          } catch (e) {
            console.error('❌ Error obteniendo admins especialidad:', e.message);
          }
        } else {
          try {
            const [generalAdmins] = await pool.query('SELECT id FROM users WHERE role = "admin_general"');
            adminIds.push(...generalAdmins.map(a => a.id));
            console.log(`✅ Admins generales: ${generalAdmins.length}`);
          } catch (e) {
            console.error('❌ Error obteniendo admin_general:', e.message);
          }
        }

        console.log(`📊 Total adminIds a notificar: ${adminIds.length}`, adminIds);

        // 3. Preparar datos
        const notificationData = {
          type: 'cancellation_request',
          title: 'Nueva solicitud de cancelación',
          message: `Dr. ${doctor.first_name || ''} ${doctor.last_name || ''} solicitó cancelar cita #${appointment[0].id}`,
          data: {
            doctor_id: doctorId,
            doctor_name: `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim(),
            appointment_id: appointment[0].id,
            cancellation_type,
            reason,
            specialty_id: doctor.specialty_id
          }
        };

        // 4. Insertar y emitir (solo si la tabla existe)
        for (const adminId of adminIds) {
          try {
            // Intentar insertar en BD
            await pool.query(
              `INSERT INTO admin_notifications (admin_id, type, title, message, data)
              VALUES (?, ?, ?, ?, ?)`,
              [adminId, notificationData.type, notificationData.title, notificationData.message, JSON.stringify(notificationData.data)]
            );
            console.log(`💾 Notificación guardada para admin ${adminId}`);
          } catch (dbError) {
            console.warn('⚠️ No se pudo guardar en admin_notifications (¿tabla no existe?):', dbError.message);
            // Continuar aunque falle la BD
          }

          // Emitir por socket (esto siempre debería funcionar)
          try {
            req.io.to(`admin-${adminId}`).emit('new-notification', notificationData);
            console.log(`📡 Socket emitido a admin-${adminId}`);
          } catch (socketError) {
            console.error('❌ Error emitiendo socket:', socketError.message);
          }
        }

        console.log('🔔 Notificaciones procesadas exitosamente');
        
      } catch (error) {
        console.error('💥 ERROR CRÍTICO en notificaciones:', error);
        // NO romper la respuesta principal
      }

      res.json({
        success: true,
        message: `Solicitud enviada (${appointmentsToRequest.length} cita(s)). Pendiente de aprobación del administrador.`,
        requested_count: appointmentsToRequest.length
      });


    } catch (error) {
      console.error('Error solicitando cancelación:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);
module.exports = router; 