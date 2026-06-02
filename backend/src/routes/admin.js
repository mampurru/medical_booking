const bcrypt = require('bcryptjs');
const express = require('express');
const router = express.Router();
console.log('✅ Cargando rutas de ADMIN...');
const { pool } = require('../config/db');
const { verifyTokenMiddleware, authorize } = require('../middleware/auth');
const { 
  sendCancellationApproved, 
  sendCancellationRejected, 
  sendReassignment,
  sendAdminCancellation  
} = require('../services/reminderService');
console.log('✅ Rutas de ADMIN cargadas correctamente'); 

// Todas las rutas de admin requieren autenticación y rol de admin
router.use(verifyTokenMiddleware);
router.use(authorize('super_admin', 'admin_general', 'admin_especialidad'));

// 📊 Estadísticas generales
router.get('/stats', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT COUNT(*) as total FROM users');
    const [doctors] = await pool.query('SELECT COUNT(*) as total FROM doctors');
    const [today] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments 
       WHERE DATE(start_time) = CURDATE()`
    );
    const [pending] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments 
       WHERE status = 'scheduled'`
    );

    res.json({
      success: true,
      data: {
        total_users: users[0].total,
        active_doctors: doctors[0].total,
        appointments_today: today[0].total,
        appointments_pending: pending[0].total
      }
    });
  } catch (error) {
    console.error('Error en stats:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// 👥 Listar todos los usuarios (CON FILTRO POR ESPECIALIDAD)
router.get('/users', async (req, res) => {
  try {
    let query = `
      SELECT id, email, role, first_name, last_name, phone, created_at, specialty_id
      FROM users 
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'admin_especialidad' && req.user.specialty_id) {
      query += ` AND (role != 'doctor' OR specialty_id = ?)`;
      params.push(req.user.specialty_id);
    }

    query += ` ORDER BY created_at DESC`;

    const [users] = await pool.query(query, params);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// 🗑️ Eliminar usuario
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [admins] = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'`
    );
    
    if (admins[0].count <= 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar el último administrador del sistema' 
      });
    }

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'No puedes eliminar tu propia cuenta' 
      });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
    
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// 📈 Reporte: Citas por médico
router.get('/reports/by-doctor', async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT 
        CONCAT(u.first_name, ' ', u.last_name) as doctor_name,
        COUNT(a.id) as total_citas,
        SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completadas,
        SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as canceladas
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN appointments a ON d.id = a.doctor_id
       GROUP BY d.id, u.first_name, u.last_name
       ORDER BY total_citas DESC`
    );
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error en reporte:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// 📈 Reporte: Citas por fecha
router.get('/reports/by-date', async (req, res) => {
  const { start_date, end_date } = req.query;
  
  try {
    let query = `
      SELECT 
        DATE(start_time) as fecha,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM appointments
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND start_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND start_time <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY DATE(start_time) ORDER BY fecha DESC';

    const [results] = await pool.query(query, params);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error en reporte por fecha:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Crear nuevo doctor
router.post('/doctors', async (req, res) => {
  const { firstName, lastName, email, password, specialty, license_number } = req.body;
  
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [userResult] = await pool.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, status)
       VALUES (?, ?, 'doctor', ?, ?, 'active')`,
      [email, passwordHash, firstName, lastName]
    );
    
    await pool.query(
      `INSERT INTO doctors (user_id, specialty, license_number, consultation_duration)
       VALUES (?, ?, ?, 30)`,
      [userResult.insertId, specialty, license_number]
    );
    
    res.status(201).json({
      success: true,
      message: 'Doctor creado exitosamente',
      data: { id: userResult.insertId, email }
    });
    
  } catch (error) {
    console.error('Error creando doctor:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Aprobar usuario
router.put('/users/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "UPDATE users SET status = 'active', updated_at = NOW() WHERE id = ?",
      [id]
    );
    res.json({ success: true, message: 'Usuario aprobado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Rechazar usuario
router.delete('/users/:id/reject', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario rechazado y eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Listar usuarios pendientes
// router.get('/users/pending',
//   verifyTokenMiddleware,
//   async (req, res) => {
//     try {
//       const userRole = req.user.role;
//       const userSpecialtyId = req.user.specialty_id;

//       let query = `
//         SELECT u.*, d.specialty_id, d.license_number, s.name as specialty_name
//         FROM users u
//         LEFT JOIN doctors d ON u.id = d.user_id
//         LEFT JOIN specialties s ON d.specialty_id = s.id
//         WHERE u.status = 'pending' AND u.role = 'doctor'
//       `;

//       const queryParams = [];

//       if (userRole === 'admin_general') {
//         query += ' AND (d.specialty_id IS NULL OR d.specialty_id IS NULL)';
//       } else if (userRole === 'admin_especialidad') {
//         if (userSpecialtyId === null || userSpecialtyId === undefined) {
//           query += ' AND d.specialty_id IS NOT NULL';
//         } else {
//           query += ' AND d.specialty_id = ?';
//           queryParams.push(userSpecialtyId);
//         }
//       }

//       query += ' ORDER BY u.created_at DESC';

//       const [users] = await pool.query(query, queryParams);

//       res.json({ success: true, users });
//     } catch (error) {
//       console.error('Error obteniendo usuarios pendientes:', error);
//       res.status(500).json({ success: false, message: 'Error del servidor' });
//     }
//   }
// );
// Listar usuarios pendientes (TODOS: pacientes y doctores)
router.get('/users/pending',
  async (req, res) => {  // ✅ Eliminar verifyTokenMiddleware duplicado
    try {
      const userRole = req.user.role;
      const userSpecialtyId = req.user.specialty_id;

      let query = `
        SELECT 
          u.id, u.email, u.role, u.first_name, u.last_name, 
          u.phone, u.identification_number, u.created_at, u.status,
          d.specialty_id, d.license_number, 
          s.name as specialty_name,
          p.date_of_birth
        FROM users u
        LEFT JOIN doctors d ON u.id = d.user_id
        LEFT JOIN patients p ON u.id = p.user_id
        LEFT JOIN specialties s ON d.specialty_id = s.id
        WHERE u.status = 'pending'
      `;

      const queryParams = [];

      // Filtrar por rol según el tipo de admin
      if (userRole === 'admin_especialidad' && userSpecialtyId) {
        query += ' AND (u.role != "doctor" OR d.specialty_id = ?)';
        queryParams.push(userSpecialtyId);
      }

      query += ' ORDER BY u.created_at DESC';

      const [users] = await pool.query(query, queryParams);

      res.json({ success: true, users });
    } catch (error) {
      console.error('Error obteniendo usuarios pendientes:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// ============================================
// NUEVAS RUTAS PARA GESTIÓN DE ADMINS
// ============================================

// 1. Obtener lista de especialidades
router.get('/specialties', async (req, res) => {
  try {
    const [specialties] = await pool.query('SELECT id, name FROM specialties ORDER BY name');
    res.json({ success: true, specialties });
  } catch (error) {
    console.error('Error obteniendo especialidades:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// 2. Crear nuevo Admin (Solo Super Admin)
router.post('/create-admin', 
  verifyTokenMiddleware, 
  authorize('super_admin'), 
  async (req, res) => {
    const { first_name, last_name, email, password, role, specialty_id } = req.body;

    try {
      const validRoles = ['admin_general', 'admin_especialidad'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Rol de admin no válido' });
      }

      if (role === 'admin_especialidad' && !specialty_id) {
        return res.status(400).json({ success: false, message: 'Se requiere especialidad para este rol' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, specialty_id, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [first_name, last_name, email, hashedPassword, role, specialty_id || null]
      );

      res.status(201).json({
        success: true,
        message: 'Admin creado exitosamente',
        data: { id: result.insertId, email, role } 
      });

    } catch (error) {
      console.error('Error creando admin:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// ✅ Aprobar solicitud de cancelación (CORREGIDO)
router.post('/cancellation-requests/:id/approve',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      const [request] = await pool.query(
        'SELECT * FROM cancellation_requests WHERE id = ? AND status = "pending"', 
        [id]
      );
      if (request.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Solicitud no encontrada o ya procesada' 
        });
      }

      const cancellation = request[0];

      const [adminInfo] = await pool.query(
        'SELECT first_name, last_name, role FROM users WHERE id = ?',
        [req.user.id]
      );

      await pool.query(
        `UPDATE cancellation_requests 
         SET status = "approved", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? 
         WHERE id = ?`,
        [req.user.id, admin_notes || '', id]
      );

      await pool.query(
        'UPDATE appointments SET status = "cancelled" WHERE id = ?', 
        [cancellation.appointment_id]
      );

      await pool.query(
        `INSERT INTO cancellation_audit_log 
         (request_id, appointment_id, doctor_id, approved_by, approved_by_role, 
          admin_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          id, 
          cancellation.appointment_id, 
          cancellation.doctor_id, 
          req.user.id,
          adminInfo[0]?.role || 'unknown',
          admin_notes || ''
        ]
      );

      // 📧 Enviar email al paciente (CORREGIDO: JOIN correcto)
      try {
        const [appointmentData] = await pool.query(`
          SELECT 
            a.id, a.start_time, a.reason,
            u.first_name as patient_first_name,  -- ✅ CORREGIDO: de users
            u.last_name as patient_last_name,    -- ✅ CORREGIDO
            u.email as patient_email,            -- ✅ CORREGIDO
            du.first_name as doctor_first_name,
            du.last_name as doctor_last_name
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id  -- appointments → patients
          JOIN users u ON p.user_id = u.id         -- patients → users (aquí está el nombre)
          JOIN doctors doc ON a.doctor_id = doc.id
          JOIN users du ON doc.user_id = du.id
          WHERE a.id = ?
        `, [cancellation.appointment_id]);

        if (appointmentData.length > 0) {
          const appt = appointmentData[0];
          
          await sendCancellationApproved(
            {
              id: appt.id,
              start_time: appt.start_time,
              reason: appt.reason,
              doctor_name: `${appt.doctor_first_name} ${appt.doctor_last_name}`.trim()
            },
            appt.patient_email,
            `${appt.patient_first_name} ${appt.patient_last_name}`.trim(),
            admin_notes || ''
          );
        }
      } catch (emailError) {
        console.error('⚠️ Error enviando email de aprobación:', emailError.message);
      }

      res.json({
        success: true,
        message: 'Cancelación aprobada. La cita ha sido marcada como cancelada.'
      });

    } catch (error) {
      console.error('Error aprobando cancelación:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// ❌ Rechazar solicitud de cancelación (CORREGIDO)
router.post('/cancellation-requests/:id/reject',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      const [request] = await pool.query('SELECT * FROM cancellation_requests WHERE id = ? AND status = "pending"', [id]);
      if (request.length === 0) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada o ya procesada' });
      }

      await pool.query(
        'UPDATE cancellation_requests SET status = "rejected", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE id = ?',
        [req.user.id, admin_notes || '', id]
      );

      // 📧 Enviar email al paciente (CORREGIDO: JOIN correcto)
      try {
        const [appointmentData] = await pool.query(`
          SELECT 
            a.id, a.start_time, a.reason,
            u.first_name as patient_first_name,  -- ✅ CORREGIDO: de users
            u.last_name as patient_last_name,
            u.email as patient_email,
            du.first_name as doctor_first_name,
            du.last_name as doctor_last_name
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id  -- ✅ CORREGIDO: patients primero
          JOIN users u ON p.user_id = u.id         -- ✅ users después
          JOIN doctors doc ON a.doctor_id = doc.id
          JOIN users du ON doc.user_id = du.id
          WHERE a.id = ?
        `, [request[0].appointment_id]);

        if (appointmentData.length > 0) {
          const appt = appointmentData[0];
          
          await sendCancellationRejected(
            {
              id: appt.id,
              start_time: appt.start_time,
              reason: appt.reason,
              doctor_name: `${appt.doctor_first_name} ${appt.doctor_last_name}`.trim()
            },
            appt.patient_email,
            `${appt.patient_first_name} ${appt.patient_last_name}`.trim(),
            admin_notes || ''
          );
        }
      } catch (emailError) {
        console.error('⚠️ Error enviando email de rechazo:', emailError.message);
      }

      res.json({
        success: true,
        message: 'Cancelación rechazada. La cita sigue programada.'
      });

    } catch (error) {
      console.error('Error rechazando cancelación:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// Listar solicitudes de cancelación
router.get('/cancellation-requests',
  verifyTokenMiddleware,
  async (req, res) => {
    try {
      const userRole = req.user.role;
      const userSpecialtyId = req.user.specialty_id;

      let query = `
        SELECT DISTINCT 
          cr.id,
          cr.appointment_id,
          cr.doctor_id,
          cr.doctor_user_id,
          cr.cancellation_type,
          cr.reason,
          cr.status,
          cr.requested_at,
          cr.admin_notes,
          cr.reviewed_at,
          cr.reviewed_by,
          a.start_time,
          du.first_name as doctor_first_name,
          du.last_name as doctor_last_name,
          pu.first_name as patient_first_name,
          pu.last_name as patient_last_name,
          d.specialty_id as doctor_specialty_id
        FROM cancellation_requests cr
        JOIN appointments a ON cr.appointment_id = a.id
        JOIN doctors d ON cr.doctor_id = d.id
        JOIN users du ON d.user_id = du.id
        JOIN users pu ON a.patient_id = pu.id
      `;

      const whereClauses = ['cr.status IN (?, ?)'];
      const queryParams = ['pending', 'approved', 'rejected'];

      if (userRole === 'admin_general') {
        whereClauses.push('d.specialty_id IS NULL');
      } else if (userRole === 'admin_especialidad') {
        if (userSpecialtyId === null || userSpecialtyId === undefined) {
          whereClauses.push('d.specialty_id IS NOT NULL');
        } else {
          whereClauses.push('d.specialty_id = ?');
          queryParams.push(userSpecialtyId);
        }
      }

      query += ' WHERE ' + whereClauses.join(' AND ');
      query += ' ORDER BY cr.requested_at DESC';

      const [requests] = await pool.query(query, queryParams);

      res.json({ success: true, requests });
    } catch (error) {
      console.error('Error obteniendo solicitudes:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// 🔄 Reasignar cita (CORREGIDO)
router.post('/cancellation-requests/:id/reassign',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { new_doctor_id, new_start_time, admin_notes } = req.body;

    try {
      const [request] = await pool.query('SELECT * FROM cancellation_requests WHERE id = ?', [id]);
      if (request.length === 0) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      }
      const originalAppointmentId = request[0].appointment_id;

      const [conflict] = await pool.query(
        `SELECT id FROM appointments 
         WHERE doctor_id = ? AND start_time = ? AND status != 'cancelled' AND id != ?`,
        [new_doctor_id, new_start_time, originalAppointmentId]
      );

      if (conflict.length > 0) {
        return res.status(400).json({ success: false, message: 'El doctor seleccionado ya tiene una cita en ese horario.' });
      }

      await pool.query(
        `UPDATE appointments 
         SET doctor_id = ?, start_time = ?, status = 'scheduled', updated_at = NOW() 
         WHERE id = ?`,
        [new_doctor_id, new_start_time, originalAppointmentId]
      );

      await pool.query(
        `UPDATE cancellation_requests 
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? 
         WHERE id = ?`,
        [req.user.id, `REASIGNADA: Doctor ID ${new_doctor_id}, Nueva Hora: ${new_start_time}. Notas: ${admin_notes || ''}`, id]
      );

      // 📧 Enviar email al paciente (CORREGIDO: JOIN correcto)
      try {
        const [appointmentData] = await pool.query(`
          SELECT 
            a.id, a.start_time as new_start_time, a.reason,
            u.first_name as patient_first_name,  -- ✅ CORREGIDO: de users
            u.last_name as patient_last_name,
            u.email as patient_email,
            du.first_name as new_doctor_first_name,
            du.last_name as new_doctor_last_name
          FROM appointments a
          JOIN patients p ON a.patient_id = p.id  -- ✅ CORREGIDO: patients primero
          JOIN users u ON p.user_id = u.id         -- ✅ users después
          JOIN doctors doc ON a.doctor_id = doc.id
          JOIN users du ON doc.user_id = du.id
          WHERE a.id = ?
        `, [originalAppointmentId]);

        if (appointmentData.length > 0) {
          const appt = appointmentData[0];
          
          const oldAppointment = {
            start_time: request[0].original_start_time || new Date()
          };
          
          const newAppointment = {
            id: appt.id,
            start_time: appt.new_start_time,
            reason: appt.reason,
            doctor_name: `${appt.new_doctor_first_name} ${appt.new_doctor_last_name}`.trim()
          };
          
          await sendReassignment(
            oldAppointment,
            newAppointment,
            appt.patient_email,
            `${appt.patient_first_name} ${appt.patient_last_name}`.trim(),
            `Reasignada por admin. Notas: ${admin_notes || ''}`
          );
        }
      } catch (emailError) {
        console.error('⚠️ Error enviando email de reasignación:', emailError.message);
      }

      res.json({ success: true, message: 'Cita reasignada correctamente' });

    } catch (error) {
      console.error('Error reasignando cita:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// 📊 Reporte de cancelaciones aprobadas (Solo Super Admin)
router.get('/cancellation-reports',
  verifyTokenMiddleware,
  authorize('super_admin'),
  async (req, res) => {
    try {
      const [reports] = await pool.query(`
        SELECT 
          cal.*,
          u.first_name as admin_first_name,
          u.last_name as admin_last_name,
          u.role as admin_role,
          d.first_name as doctor_first_name,
          d.last_name as doctor_last_name,
          cr.reason as cancellation_reason,
          a.start_time as appointment_date
        FROM cancellation_audit_log cal
        JOIN users u ON cal.approved_by = u.id
        JOIN users d ON cal.doctor_id = d.id
        JOIN cancellation_requests cr ON cal.request_id = cr.id
        LEFT JOIN appointments a ON cal.appointment_id = a.id
        ORDER BY cal.created_at DESC
      `);
      
      res.json({ success: true, reports });
    } catch (error) {
      console.error('Error obteniendo reporte:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// 📬 Obtener notificaciones del admin actual
router.get('/notifications',
  verifyTokenMiddleware,
  async (req, res) => {
    try {
      const [notifications] = await pool.query(
        `SELECT * FROM admin_notifications 
         WHERE admin_id = ? 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [req.user.id]
      );

      const [unread] = await pool.query(
        `SELECT COUNT(*) as count FROM admin_notifications 
         WHERE admin_id = ? AND is_read = FALSE`,
        [req.user.id]
      );

      res.json({
        success: true,
        notifications,
        unreadCount: unread[0].count
      });
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// ✅ Marcar notificación como leída
router.put('/notifications/:id/read',
  verifyTokenMiddleware,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE admin_notifications 
         SET is_read = TRUE 
         WHERE id = ? AND admin_id = ?`,
        [req.params.id, req.user.id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);

// ✅ Marcar todas como leídas
router.put('/notifications/read-all',
  verifyTokenMiddleware,
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE admin_notifications 
         SET is_read = TRUE 
         WHERE admin_id = ?`,
        [req.user.id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);
// ❌ Cancelar cita directamente por admin (sin solicitud del paciente)
router.put('/appointments/:id/cancel-by-admin',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      // 1. Obtener datos de la cita
      const [appointmentData] = await pool.query(`
        SELECT 
          a.id, a.start_time,
          u.first_name as patient_first_name,
          u.last_name as patient_last_name,
          u.email as patient_email,
          du.first_name as doctor_first_name,
          du.last_name as doctor_last_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users u ON p.user_id = u.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users du ON d.user_id = du.id
        WHERE a.id = ?
      `, [id]);

      if (appointmentData.length === 0) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada' });
      }

      const appt = appointmentData[0];

      // 2. Cancelar la cita
      await pool.query('UPDATE appointments SET status = "cancelled" WHERE id = ?', [id]);

      // 3. 📧 Enviar email DIFERENTE (cancelación por admin)
      try {
        await sendAdminCancellation(
          {
            id: appt.id,
            start_time: appt.start_time,
            doctor_name: `${appt.doctor_first_name} ${appt.doctor_last_name}`.trim()
          },
          appt.patient_email,
          `${appt.patient_first_name} ${appt.patient_last_name}`.trim(),
          `${appt.doctor_first_name} ${appt.doctor_last_name}`.trim(),
          admin_notes || 'Cancelación administrativa'
        );
      } catch (emailError) {
        console.error('⚠️ Error enviando email:', emailError.message);
      }

      res.json({
        success: true,
        message: 'Cita cancelada por el administrador'
      });

    } catch (error) {
      console.error('Error cancelando cita:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);
module.exports = router;