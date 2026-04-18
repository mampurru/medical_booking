const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');

// Registro de usuario
exports.register = async (req, res) => {
  const { email, password, role, firstName, lastName, phone, specialty, dateOfBirth,license_number } = req.body;

  try {
    // 1. Verificar si el email ya existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'El email ya está registrado' 
      });
    }

    // 2. Determinar status según el rol
    const status = role === 'patient' ? 'active' : 'pending';

    // 3. Hashear contraseña
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Crear usuario
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, role, firstName, lastName, phone, status]
    );

    const userId = result.insertId;

    // 5. Crear perfil específico según el rol
    if (role === 'patient') {
      await pool.query(
        'INSERT INTO patients (user_id, date_of_birth) VALUES (?, ?)',
        [userId, dateOfBirth || null]
      );
    } else if (role === 'doctor') {  
      await pool.query(
        'INSERT INTO doctors (user_id, specialty, license_number) VALUES (?, ?, ?)',
        [userId, specialty || 'Medicina General', license_number ||`DOC-${userId}`]
      );
    }

    // En el backend, antes de insertar:
    if (role === 'doctor' && !license_number?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El número de licencia es requerido para doctores'
      });
    }

    // 6. Generar token
    const token = generateToken(userId, role);

    res.status(201).json({
      success: true,
      message: status === 'pending' 
        ? 'Registro exitoso. Tu cuenta está pendiente de aprobación.' 
        : 'Usuario registrado exitosamente',
      data: {
        token,
        user: {
          id: userId,
          email,
          role,
          firstName,
          lastName
        }
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
};
// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('🔍 [LOGIN START] Email:', email);
    // Buscar usuario
    const [users] = await pool.query(
      'SELECT id, email, password_hash, role, first_name, last_name, status FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log('❌ [LOGIN] Usuario NO encontrado en BD');
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    const user = users[0];
    console.log('✅ [LOGIN] Usuario encontrado:', user.email, '| Status:', user.status);


    console.log('🔐 [LOGIN] Comparando contraseña...');
    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log('🔑 [LOGIN] Resultado bcrypt.compare:', isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }
    // Después de verificar contraseña, agrega:
    if (user.status !== 'active') {
      console.log('⚠️ [LOGIN] Usuario no activo:', user.status);
      return res.status(403).json({
        success: false,
        message: user.status === 'pending' 
          ? 'Tu cuenta está pendiente de aprobación por un administrador' 
          : 'Tu cuenta ha sido suspendida. Contacta a soporte.'
      });
    }
    console.log('🎫 [LOGIN] Generando token con ID:', user.id, 'y role:', user.role);
    console.log('🔐 [LOGIN] JWT_SECRET existe:', !!process.env.JWT_SECRET);
    // Generar token
    const token = generateToken(user.id, user.role);
    console.log('✅ [LOGIN] Token generado exitosamente');
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {  
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name
        }
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    console.error('💥 [LOGIN ERROR] Excepción no capturada:', error.message);
    console.error('💥 [LOGIN ERROR] Stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
};

// Obtener perfil del usuario actual
exports.getProfile = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, role, first_name, last_name, phone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    const user = users[0];
    let profileData = null;

    // Obtener datos específicos según el rol
    if (user.role === 'patient') {
      const [patients] = await pool.query(
        'SELECT * FROM patients WHERE user_id = ?',
        [user.id]
      );
      profileData = patients[0];
    } else if (user.role === 'doctor') {
      const [doctors] = await pool.query(
        'SELECT * FROM doctors WHERE user_id = ?',
        [user.id]
      );
      profileData = doctors[0];
    }

    res.json({
      success: true,
      data: {  
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          createdAt: user.created_at
        },
        profile: profileData
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
};