const bcrypt = require('bcryptjs'); // ✅ Agregar esta línea
const express = require('express');
const router = express.Router();
console.log('✅ Cargando rutas de ADMIN...');
const { pool } = require('../config/db');
const { verifyTokenMiddleware, authorize } = require('../middleware/auth');
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
       data:{
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

// 👥 Listar todos los usuarios
// router.get('/users', async (req, res) => {
//   try {
//     const [users] = await pool.query(
//       `SELECT id, email, role, first_name, last_name, phone, created_at 
//        FROM users 
//        ORDER BY created_at DESC`
//     );
//     res.json({ success: true,  users });
//   } catch (error) {
//     console.error('Error obteniendo usuarios:', error);
//     res.status(500).json({ success: false, message: 'Error del servidor' });
//   }
// });
// 👥 Listar todos los usuarios (CON FILTRO POR ESPECIALIDAD)
router.get('/users', async (req, res) => {
  try {
    let query = `
      SELECT id, email, role, first_name, last_name, phone, created_at, specialty_id
      FROM users 
      WHERE 1=1
    `;
    const params = [];

    // 🔐 Si es admin de especialidad, solo ver doctores de su especialidad
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

// 🗑️ Eliminar usuario (solo si no es el último admin)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar que no sea el último admin
    const [admins] = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'`
    );
    
    if (admins[0].count <= 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede eliminar el último administrador del sistema' 
      });
    }

    // Verificar que no se esté eliminando a sí mismo
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
    
    res.json({ success: true,  results });
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
    res.json({ success: true,  results });
  } catch (error) {
    console.error('Error en reporte por fecha:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});
// Crear nuevo doctor (solo admin)
router.post('/doctors', async (req, res) => {
  const { firstName, lastName, email, password, specialty, license_number } = req.body;
  
  try {
    // 1. Crear usuario
    const passwordHash = await bcrypt.hash(password, 12);
    const [userResult] = await pool.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, status)
       VALUES (?, ?, 'doctor', ?, ?, 'active')`,
      [email, passwordHash, firstName, lastName]
    );
    
    // 2. Crear perfil de doctor
    await pool.query(
      `INSERT INTO doctors (user_id, specialty, license_number, consultation_duration)
       VALUES (?, ?, ?, 30)`,
      [userResult.insertId, specialty, license_number]
    );
    
    res.status(201).json({
      success: true,
      message: 'Doctor creado exitosamente',
      data :{ id: userResult.insertId, email }
    });
    
  } catch (error) {
    console.error('Error creando doctor:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
})

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
router.get('/users/pending', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, email, role, first_name, last_name, phone, created_at 
       FROM users WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json({ success: true,  users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});
// ============================================
// NUEVAS RUTAS PARA GESTIÓN DE ADMINS
// ============================================

// 1. Obtener lista de especialidades
router.get('/specialties', async (req, res) => {
  try {
    const [specialties] = await pool.query('SELECT id, name FROM specialties ORDER BY name');
    res.json({ success: true,  specialties });
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
      // Validaciones
      const validRoles = ['admin_general', 'admin_especialidad'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Rol de admin no válido' });
      }

      if (role === 'admin_especialidad' && !specialty_id) {
        return res.status(400).json({ success: false, message: 'Se requiere especialidad para este rol' });
      }

      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insertar en BD
      // const [result] = await pool.query(
      //   `INSERT INTO users (first_name, last_name, email, password, role, specialty_id) 
      //    VALUES (?, ?, ?, ?, ?, ?)`,
      //   [first_name, last_name, email, hashedPassword, role, specialty_id || null]
      // );
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
// ✅ Aprobar solicitud de cancelación
router.post('/cancellation-requests/:id/approve',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      // 1. Verificar que la solicitud existe y está pendiente
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

      // 2. Obtener información del admin que aprueba
      const [adminInfo] = await pool.query(
        'SELECT first_name, last_name, role FROM users WHERE id = ?',
        [req.user.id]
      );

      // 3. Actualizar estado de la solicitud
      await pool.query(
        `UPDATE cancellation_requests 
         SET status = "approved", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? 
         WHERE id = ?`,
        [req.user.id, admin_notes || '', id]
      );

      // 4. Actualizar la cita a 'cancelled'
      await pool.query(
        'UPDATE appointments SET status = "cancelled" WHERE id = ?', 
        [cancellation.appointment_id]
      );

      // 5. 🔔 CREAR REGISTRO DE AUDITORÍA PARA SUPER ADMIN
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

      // 6. 📧 TODO: Enviar email al paciente y al super admin
      // await sendEmailToSuperAdmin({...});

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

// ❌ Rechazar solicitud de cancelación
router.post('/cancellation-requests/:id/reject',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      // 1. Verificar que la solicitud existe y está pendiente
      const [request] = await pool.query('SELECT * FROM cancellation_requests WHERE id = ? AND status = "pending"', [id]);
      if (request.length === 0) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada o ya procesada' });
      }

      // 2. Actualizar estado a 'rejected'
      await pool.query(
        'UPDATE cancellation_requests SET status = "rejected", reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? WHERE id = ?',
        [req.user.id, admin_notes || '', id]
      );

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

// 📋 Obtener todas las solicitudes de cancelación (Historial)
router.get('/cancellation-requests',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    try {
      let query = `
        SELECT cr.*, 
               u.first_name as doctor_first_name, u.last_name as doctor_last_name,
               a.patient_id, p.first_name as patient_first_name, p.last_name as patient_last_name
        FROM cancellation_requests cr
        JOIN doctors d ON cr.doctor_id = d.id
        JOIN users u ON d.user_id = u.id
        JOIN appointments a ON cr.appointment_id = a.id
        JOIN users p ON a.patient_id = p.id
        WHERE 1=1
      `;
      const params = [];

      // Filtro por especialidad si es admin_especialidad
      if (req.user.role === 'admin_especialidad' && req.user.specialty_id) {
        query += ' AND d.specialty_id = ?';
        params.push(req.user.specialty_id);
      }

      query += ' ORDER BY cr.requested_at DESC';

      const [requests] = await pool.query(query, params);
      res.json({ success: true, requests });

    } catch (error) {
      console.error('Error obteniendo solicitudes:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);
// 🔄 Reasignar cita (Cambia doctor y/o fecha)
router.post('/cancellation-requests/:id/reassign',
  verifyTokenMiddleware,
  authorize('super_admin', 'admin_general', 'admin_especialidad'),
  async (req, res) => {
    const { id } = req.params;
    const { new_doctor_id, new_start_time, admin_notes } = req.body;

    try {
      // 1. Obtener la solicitud original
      const [request] = await pool.query('SELECT * FROM cancellation_requests WHERE id = ?', [id]);
      if (request.length === 0) {
        return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      }
      const originalAppointmentId = request[0].appointment_id;

      // 2. Verificar que el NUEVO doctor esté libre en esa fecha/hora
      const [conflict] = await pool.query(
        `SELECT id FROM appointments 
         WHERE doctor_id = ? AND start_time = ? AND status != 'cancelled' AND id != ?`,
        [new_doctor_id, new_start_time, originalAppointmentId]
      );

      if (conflict.length > 0) {
        return res.status(400).json({ success: false, message: 'El doctor seleccionado ya tiene una cita en ese horario.' });
      }

      // 3. Actualizar la cita original (Cambiar doctor y fecha)
      await pool.query(
        `UPDATE appointments 
         SET doctor_id = ?, start_time = ?, status = 'scheduled', updated_at = NOW() 
         WHERE id = ?`,
        [new_doctor_id, new_start_time, originalAppointmentId]
      );

      // 4. Marcar la solicitud de cancelación como "Aprobada/Resuelta"
      await pool.query(
        `UPDATE cancellation_requests 
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? 
         WHERE id = ?`,
        [req.user.id, `REASIGNADA: Doctor ID ${new_doctor_id}, Nueva Hora: ${new_start_time}. Notas: ${admin_notes || ''}`, id]
      );

      // TODO: Aquí iría el email al paciente avisando del cambio

      res.json({ success: true, message: 'Cita reasignada correctamente' });

    } catch (error) {
      console.error('Error reasignando cita:', error);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  }
);
module.exports = router;