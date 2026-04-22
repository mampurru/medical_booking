const { pool } = require('../config/db');
const { sendAppointmentReminder, sendTwoHourReminder } = require('./emailService');

/**
 * Cron Job: Enviar recordatorios (24h y 2h antes)
 * Se ejecuta cada 15 minutos
 */
const sendReminders = async () => {
  console.log('🔔 [CRON] Iniciando envío de recordatorios...');
  
  try {
    const now = new Date();
    
    // ===== RECORDATORIO 24 HORAS =====
    const tomorrowSameTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowPlus15min = new Date(tomorrowSameTime.getTime() + 15 * 60 * 1000);
    
    const [appointments24h] = await pool.query(`
      SELECT 
        a.id, a.start_time, a.reason, a.doctor_id, a.reminder_24h_sent,
        p.user_id as patient_id,
        u.email as patient_email,
        u.first_name as patient_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE 
        a.start_time BETWEEN ? AND ?
        AND a.status = 'scheduled'
        AND a.reminder_24h_sent = 0
    `, [tomorrowSameTime, tomorrowPlus15min]);

    console.log(`📋 [24H] Encontradas ${appointments24h.length} citas para recordatorio 24h`);

    for (const appointment of appointments24h) {
      const success = await sendAppointmentReminder(
        appointment,
        appointment.patient_email,
        appointment.patient_name
      );

      if (success) {
        await pool.query(
          'UPDATE appointments SET reminder_24h_sent = 1 WHERE id = ?',
          [appointment.id]
        );
      }
    }

    // ===== RECORDATORIO 2 HORAS =====
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursPlus15min = new Date(twoHoursLater.getTime() + 15 * 60 * 1000);
    
    const [appointments2h] = await pool.query(`
      SELECT 
        a.id, a.start_time, a.reason, a.doctor_id, a.reminder_2h_sent,
        p.user_id as patient_id,
        u.email as patient_email,
        u.first_name as patient_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE 
        a.start_time BETWEEN ? AND ?
        AND a.status = 'scheduled'
        AND a.reminder_2h_sent = 0
    `, [twoHoursLater, twoHoursPlus15min]);

    console.log(`📋 [2H] Encontradas ${appointments2h.length} citas para recordatorio 2h`);

    for (const appointment of appointments2h) {
      const success = await sendTwoHourReminder(
        appointment,
        appointment.patient_email,
        appointment.patient_name
      );

      if (success) {
        await pool.query(
          'UPDATE appointments SET reminder_2h_sent = 1 WHERE id = ?',
          [appointment.id]
        );
      }
    }

    console.log(`✅ [CRON] Recordatorios completados`);
    
  } catch (error) {
    console.error('❌ [CRON] Error en sendReminders:', error.message);
  }
};

module.exports = { sendReminders };