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
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, email, role, first_name, last_name, phone, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json({ success: true,  users });
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
module.exports = router;