const { pool } = require('../config/db');
const { sendAppointmentReminder } = require('./emailService');

/**
 * Cron Job: Enviar recordatorios para citas en las próximas 24 horas
 * Se ejecuta cada 15 minutos
 */
const sendReminders = async () => {
  console.log('🔔 [CRON] Iniciando envío de recordatorios...');
  
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Buscar citas programadas para mañana que aún no han sido recordadas
    const [appointments] = await pool.query(`
      SELECT 
        a.id,
        a.start_time,
        a.reason,
        a.doctor_id,
        a.reminder_sent,
        p.user_id as patient_id,
        u.email as patient_email,
        u.first_name as patient_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN users u ON p.user_id = u.id
      WHERE 
        a.start_time BETWEEN ? AND ?
        AND a.status = 'scheduled'
        AND a.reminder_sent = 0
    `, [now, tomorrow]);

    console.log(`📋 [CRON] Encontradas ${appointments.length} citas para enviar recordatorio`);

    let sentCount = 0;
    let failedCount = 0;

    for (const appointment of appointments) {
      const success = await sendAppointmentReminder(
        appointment,
        appointment.patient_email,
        appointment.patient_name
      );

      if (success) {
        // Marcar recordatorio como enviado en la BD
        await pool.query(
          'UPDATE appointments SET reminder_sent = 1 WHERE id = ?',
          [appointment.id]
        );
        sentCount++;
      } else {
        failedCount++;
      }
    }

    console.log(`✅ [CRON] Recordatorios completados: ${sentCount} enviados, ${failedCount} fallidos`);
    
  } catch (error) {
    console.error('❌ [CRON] Error en sendReminders:', error.message);
  }
};

module.exports = { sendReminders };