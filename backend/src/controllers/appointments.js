const { pool } = require('../config/db');
const { createCalendarEvent } = require('../services/googleCalendarService');

// Obtener todas las citas (con filtros)
exports.getAppointments = async (req, res) => {
  const { doctor_id, patient_id, status, start_date, end_date } = req.query;
  const user = req.user;

  try {
    let query = `
      SELECT 
        a.*, 
        CONCAT(u.first_name, ' ', u.last_name) as patient_name,
        u.email as patient_email,
        u.phone as patient_phone,
        CONCAT(du.first_name, ' ', du.last_name) as doctor_name,
        doc.specialty
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN doctors doc ON a.doctor_id = doc.id
      JOIN users du ON doc.user_id = du.id
      WHERE 1=1
    `;
    const params = [];

    // Filtros según el rol
    if (user.role === 'patient') {
      const [patientData] = await pool.query(
        'SELECT id FROM patients WHERE user_id = ?', 
        [user.id]
      );
      if (patientData.length === 0) {
        return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
      }
      query += ' AND a.patient_id = ?';
      params.push(patientData[0].id);
    } else if (user.role === 'doctor') {
      const [doctorData] = await pool.query(
        'SELECT id FROM doctors WHERE user_id = ?', 
        [user.id]
      );
      if (doctorData.length === 0) {
        return res.status(404).json({ success: false, message: 'Perfil de doctor no encontrado' });
      }
      query += ' AND a.doctor_id = ?';
      params.push(doctorData[0].id);
    } else {
      if (doctor_id) {
        query += ' AND a.doctor_id = ?';
        params.push(doctor_id);
      }
      if (patient_id) {
        query += ' AND a.patient_id = ?';
        params.push(patient_id);
      }
    }

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (start_date && end_date) {
      query += ' AND a.start_time BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY a.start_time ASC';

    const [appointments] = await pool.query(query, params);

    const formattedAppointments = appointments.map(apt => ({
      ...apt,
      start_time: apt.start_time instanceof Date 
        ? apt.start_time.toISOString().replace('Z', '').split('.')[0]
        : apt.start_time,
      end_time: apt.end_time instanceof Date 
        ? apt.end_time.toISOString().replace('Z', '').split('.')[0]
        : apt.end_time,
    }));
    
    res.json({
      success: true,
      count: formattedAppointments.length,
      data: formattedAppointments
    });

  } catch (error) {
    console.error('❌ ERROR CRÍTICO en getAppointments:', {
      message: error.message,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false, 
      message: 'Error del servidor: ' + error.message,
      debug: process.env.NODE_ENV === 'development' ? error.sqlMessage : undefined
    });
  }
};

// Obtener una cita por ID
exports.getAppointmentById = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const query = `
      SELECT 
        a.*, 
        CONCAT(u.first_name, ' ', u.last_name) as patient_name,
        u.email as patient_email,
        u.phone as patient_phone,
        p.date_of_birth,
        p.address,
        CONCAT(du.first_name, ' ', du.last_name) as doctor_name,
        doc.specialty,
        d.license_number
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN doctors doc ON a.doctor_id = doc.id
      JOIN users du ON doc.user_id = du.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?
    `;

    const [appointments] = await pool.query(query, [id]);

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    const appointment = appointments[0];

    if (user.role === 'patient') {
      const [patientData] = await pool.query(
        'SELECT user_id FROM patients WHERE id = ?', 
        [appointment.patient_id]
      );
      if (patientData[0]?.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta cita' });
      }
    } else if (user.role === 'doctor') {
      const [doctorData] = await pool.query(
        'SELECT user_id FROM doctors WHERE id = ?', 
        [appointment.doctor_id]
      );
      if (doctorData[0]?.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta cita' });
      }
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('Error obteniendo cita:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

// Crear nueva cita
exports.createAppointment = async (req, res) => {
  const { doctor_id, patient_id, start_time, end_time, reason } = req.body;
  const user = req.user;

  try {
    if (!doctor_id || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Doctor, fecha de inicio y fecha de fin son requeridos' 
      });
    }

    let finalPatientId = patient_id;
    if (user.role === 'patient') {
      const [patientData] = await pool.query(
        'SELECT id FROM patients WHERE user_id = ?', 
        [user.id]
      );
      if (patientData.length === 0) {
        return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
      }
      finalPatientId = patientData[0].id;
      
      if (patient_id && patient_id !== finalPatientId) {
        return res.status(403).json({ 
          success: false, 
          message: 'No puedes agendar citas para otro paciente' 
        });
      }
    } else if (user.role === 'doctor' || user.role === 'admin') {
      if (!patient_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'patient_id es requerido para doctores y administradores' 
        });
      }
    }

    const [doctors] = await pool.query(
      'SELECT id, consultation_duration FROM doctors WHERE id = ?', 
      [doctor_id]
    );
    if (doctors.length === 0) {
      return res.status(404).json({ success: false, message: 'Médico no encontrado' });
    }

    const [patients] = await pool.query(
      'SELECT id FROM patients WHERE id = ?', 
      [finalPatientId]
    );
    if (patients.length === 0) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }

    const [conflicts] = await pool.query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE doctor_id = ? 
       AND status != 'cancelled'
       AND (
         (start_time < ? AND end_time > ?) OR
         (start_time < ? AND end_time > ?) OR
         (start_time >= ? AND end_time <= ?)
       )`,
      [doctor_id, end_time, start_time, end_time, start_time, start_time, end_time]
    );

    if (conflicts[0].count > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'El horario seleccionado no está disponible. Ya existe una cita en ese rango.' 
      });
    }

    if (new Date(start_time) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se pueden agendar citas en el pasado' 
      });
    }
        // === 🕐 VALIDAR HORARIO DE OFICINA (8 AM - 6 PM Colombia) ===
    const validateOfficeHours = (dateString) => {
      if (!dateString) return false;
      
      try {
        // Crear objeto Date desde el string ISO
        const date = new Date(dateString);
        
        // Obtener la hora (0-23)
        const hours = date.getHours();
        
        // Validar: 8 <= hours < 18 (8 AM a 5:59 PM)
        return hours >= 8 && hours < 18;
      } catch (error) {
        console.error('❌ Error validando horario:', error);
        return false;
      }
    };

    if (!validateOfficeHours(start_time)) {
      console.log('⚠️ Horario fuera de rango:', start_time);
      return res.status(400).json({
        success: false,
        message: 'Las citas solo pueden agendarse en horario de oficina (8:00 AM - 6:00 PM)'
      });
    }
    // ============================================================
    // Crear la cita
    const [result] = await pool.query(
      `INSERT INTO appointments 
       (patient_id, doctor_id, start_time, end_time, reason, status, reminder_sent) 
       VALUES (?, ?, ?, ?, ?, 'scheduled', FALSE)`,
      [finalPatientId, doctor_id, start_time, end_time, reason || null]
    );

    // Obtener la cita creada con datos completos
    const [newAppointment] = await pool.query(
      `SELECT a.*, 
        CONCAT(u.first_name, ' ', u.last_name) as patient_name,
        CONCAT(du.first_name, ' ', du.last_name) as doctor_name,
        doc.specialty
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN doctors doc ON a.doctor_id = doc.id
      JOIN users du ON doc.user_id = du.id
      WHERE a.id = ?`,
      [result.insertId]
    );

    // === INTEGRACIÓN GOOGLE CALENDAR ===
    createCalendarEvent({
      patient_name: newAppointment[0].patient_name,
      start_time: newAppointment[0].start_time,
      end_time: newAppointment[0].end_time,
      reason: newAppointment[0].reason,
      doctor_id: newAppointment[0].doctor_id
    }).catch(err => console.error("❌ Error en Google Calendar:", err));
    // ====================================

    res.status(201).json({
      success: true,
      message: 'Cita creada exitosamente',
      data: newAppointment[0]
    });

  } catch (error) {
    console.error('Error creando cita:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

// Actualizar cita (solo ciertos campos)
exports.updateAppointment = async (req, res) => {
  const { id } = req.params;
  const { status, clinical_notes, reason } = req.body;
  const user = req.user;

  try {
    const [appointments] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?', 
      [id]
    );
    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    const appointment = appointments[0];

    if (user.role === 'patient') {
      const [patientData] = await pool.query(
        'SELECT user_id FROM patients WHERE id = ?', 
        [appointment.patient_id]
      );
      if (patientData[0]?.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta cita' });
      }
      if (clinical_notes || (status && status !== 'cancelled')) {
        return res.status(403).json({ 
          success: false, 
          message: 'Solo puedes cancelar tu cita, no modificar otros campos' 
        });
      }
    } else if (user.role === 'doctor') {
      const [doctorData] = await pool.query(
        'SELECT user_id FROM doctors WHERE id = ?', 
        [appointment.doctor_id]
      );
      if (doctorData[0]?.user_id !== user.id) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta cita' });
      }
    }

    const updates = [];
    const values = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (clinical_notes !== undefined) {
      updates.push('clinical_notes = ?');
      values.push(clinical_notes);
    }
    if (reason !== undefined) {
      updates.push('reason = ?');
      values.push(reason);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se proporcionaron campos para actualizar' 
      });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(query, values);

    const [updatedAppointment] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?', 
      [id]
    );

    res.json({
      success: true,
      message: 'Cita actualizada exitosamente',
      data: updatedAppointment[0]
    });

  } catch (error) {
    console.error('Error actualizando cita:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

// Cancelar cita
exports.cancelAppointment = async (req, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;
  const user = req.user;

  try {
    const [appointments] = await pool.query(
      `SELECT a.*, p.user_id as patient_user_id, d.user_id as doctor_user_id
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = ?`,
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    const appointment = appointments[0];

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'La cita ya está cancelada' });
    }

    if (user.role === 'patient' && appointment.patient_user_id !== user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para cancelar esta cita' });
    }
    if (user.role === 'doctor' && appointment.doctor_user_id !== user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para cancelar esta cita' });
    }

    const hoursUntilAppointment = (new Date(appointment.start_time) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilAppointment < 2 && user.role === 'patient') {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede cancelar con menos de 2 horas de anticipación. Contacta a la clínica.' 
      });
    }

    await pool.query(
      `UPDATE appointments 
       SET status = 'cancelled', 
           clinical_notes = ?,
           updated_at = NOW() 
       WHERE id = ?`,
      [cancellation_reason ? `Cancelada: ${cancellation_reason}` : null, id]
    );

    res.json({
      success: true,
      message: 'Cita cancelada exitosamente'
    });

  } catch (error) {
    console.error('Error cancelando cita:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

// Reprogramar cita
exports.rescheduleAppointment = async (req, res) => {
  const { id } = req.params;
  const { new_start_time, new_end_time } = req.body;
  const user = req.user;

  
  try {
    // VALIDAR QUE SOLO ADMINS PUEDAN REPROGRAMAR
    const allowedRoles = ['super_admin', 'admin_general', 'admin_especialidad'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden reprogramar citas. Contacta al área administrativa.'
      });
    }
    if (!new_start_time || !new_end_time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nueva fecha de inicio y fin son requeridas' 
      });
    }
    
    const [appointments] = await pool.query(
      `SELECT a.*, d.user_id as doctor_user_id
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = ?`,
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    const appointment = appointments[0];

    if (user.role === 'patient') {
      return res.status(403).json({ 
        success: false, 
        message: 'Los pacientes no pueden reprogramar. Deben cancelar y agendar una nueva.' 
      });
    }
    if (user.role === 'doctor' && appointment.doctor_user_id !== user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para reprogramar esta cita' });
    }

    if (new Date(new_start_time) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se puede reprogramar a una fecha en el pasado' 
      });
    }

    const [conflicts] = await pool.query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE doctor_id = ? 
       AND id != ?
       AND status != 'cancelled'
       AND (
         (start_time < ? AND end_time > ?) OR
         (start_time < ? AND end_time > ?)
       )`,
      [appointment.doctor_id, id, new_end_time, new_start_time, new_end_time, new_start_time]
    );

    if (conflicts[0].count > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'El nuevo horario no está disponible' 
      });
    }

    await pool.query(
      `UPDATE appointments 
       SET start_time = ?, end_time = ?, status = 'rescheduled', updated_at = NOW() 
       WHERE id = ?`,
      [new_start_time, new_end_time, id]
    );

    const [updatedAppointment] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?', 
      [id]
    );

    res.json({
      success: true,
      message: 'Cita reprogramada exitosamente',
      data: updatedAppointment[0]
    });

  } catch (error) {
    console.error('Error reprogramando cita:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

// Eliminar cita (solo admin)
exports.deleteAppointment = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Solo los administradores pueden eliminar citas permanentemente' 
      });
    }

    const [result] = await pool.query(
      'DELETE FROM appointments WHERE id = ?', 
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    }

    res.json({
      success: true,
      message: 'Cita eliminada permanentemente'
    });

  } catch (error) {
    console.error('Error eliminando cita:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};

// Obtener disponibilidad de un médico (horarios libres)
exports.getDoctorAvailability = async (req, res) => {
  const { doctor_id, date } = req.query;

  try {
    if (!doctor_id || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'doctor_id y date son requeridos' 
      });
    }

    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    
    const [availability] = await pool.query(
      `SELECT * FROM doctor_availability 
       WHERE doctor_id = ? AND day_of_week = ? AND is_active = TRUE`,
      [doctor_id, dayName]
    );

    if (availability.length === 0) {
      return res.json({
        success: true,
        message: 'El médico no tiene disponibilidad este día',
        data: { available_slots: [] }
      });
    }

    const [appointments] = await pool.query(
      `SELECT start_time, end_time FROM appointments
       WHERE doctor_id = ? 
       AND DATE(start_time) = ?
       AND status != 'cancelled'`,
      [doctor_id, date]
    );

    const availableSlots = [];
    const slotDuration = 30;

    availability.forEach(slot => {
      let currentTime = new Date(`${date}T${slot.start_time}`);
      const endTime = new Date(`${date}T${slot.end_time}`);

      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);
        
        const hasConflict = appointments.some(apt => {
          const aptStart = new Date(apt.start_time);
          const aptEnd = new Date(apt.end_time);
          return (currentTime < aptEnd && slotEnd > aptStart);
        });

        if (!hasConflict && slotEnd <= endTime) {
          availableSlots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString()
          });
        }

        currentTime = slotEnd;
      }
    });

    res.json({
      success: true,
      data: {
        available_slots: availableSlots,
        date,
        doctor_id
      }
    });

  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};