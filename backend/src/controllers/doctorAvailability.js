const { pool } = require('../config/db');

exports.getAvailability = async (req, res) => {
  const { doctor_id } = req.params;
  try {
    const [availability] = await pool.query(
      `SELECT * FROM doctor_availability 
       WHERE doctor_id = ? AND is_active = TRUE 
       ORDER BY FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`,
      [doctor_id]
    );
    res.json({ success: true, data: availability });
  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

exports.updateAvailability = async (req, res) => {
  const { availability } = req.body;
  const user = req.user;
  try {
    const [doctorData] = await pool.query(
      'SELECT id FROM doctors WHERE user_id = ?', [user.id]
    );
    if (doctorData.length === 0) {
      return res.status(404).json({ success: false, message: 'Perfil de doctor no encontrado' });
    }
    const doctor_id = doctorData[0].id;

    await pool.query('DELETE FROM doctor_availability WHERE doctor_id = ?', [doctor_id]);

    for (const day of availability) {
      await pool.query(
        `INSERT INTO doctor_availability 
         (doctor_id, day_of_week, start_time, end_time, lunch_start, lunch_end, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [doctor_id, day.day_of_week, day.start_time, day.end_time, day.lunch_start || null, day.lunch_end || null]
      );
    }
    res.json({ success: true, message: 'Horario actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

module.exports = exports;