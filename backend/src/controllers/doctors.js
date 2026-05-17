const { pool } = require('../config/db');

exports.getAllDoctors = async (req, res) => {
  try {
    const query = `
      SELECT 
        d.id, 
        d.specialty, 
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email 
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      ORDER BY u.first_name ASC
    `;
    
    const [doctors] = await pool.query(query);
    
    res.json({
      success: true,
      count: doctors.length,
      data: { doctors }
    });
  } catch (error) {
    console.error('❌ Error en getAllDoctors:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor: ' + error.message 
    });
  }
};
exports.getMyProfile = async (req, res) => {
  try {
    const [doctor] = await pool.query(
      `SELECT d.id, d.specialty, d.consultation_duration,
              u.first_name, u.last_name, u.email
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = ?`,
      [req.user.id]
    );

    if (doctor.length === 0) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
    }

    res.json({ success: true, data: doctor[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};
module.exports = exports;