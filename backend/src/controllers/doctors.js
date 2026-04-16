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

module.exports = exports;