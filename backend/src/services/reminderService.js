const { pool } = require('../config/db');
const { sendAppointmentReminder, sendTwoHourReminder } = require('./emailService');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
/**
 * Cron Job: Enviar recordatorios (24h y 2h antes)
 * Se ejecuta cada 15 minutos
 */
const sendReminders = async () => {
  console.log('🔔 [CRON] Iniciando envío de recordatorios...');
  
  try {
    const now = new Date();
    
    // ===== RECORDATORIO 24 HORAS =====
    // Busca citas entre 23 y 25 horas (ventana de 2 horas alrededor de 24h)
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
        a.start_time > NOW()
        AND TIMESTAMPDIFF(HOUR, NOW(), a.start_time) BETWEEN 23 AND 25
        AND a.status = 'scheduled'
        AND a.reminder_24h_sent = 0
    `);

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
    // Busca citas entre 1.5 y 3 horas (ventana de 1.5 horas alrededor de 2h)
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
        a.start_time > NOW()
        AND TIMESTAMPDIFF(HOUR, NOW(), a.start_time) BETWEEN 1.5 AND 3
        AND a.status = 'scheduled'
        AND a.reminder_2h_sent = 0
    `);

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
// ============================================================================
// 📧 NUEVAS FUNCIONES PARA CANCELACIONES
// ============================================================================

/**
 * Enviar email cuando se APRUEBA una cancelación
 */
const sendCancellationApproved = async (appointment, patientEmail, patientName, adminNotes) => {
  const date = new Date(appointment.start_time);
  const formattedDate = date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const msg = {
    to: patientEmail,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'Medical Booking' },
    subject: `✅ Cancelación Aprobada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">Hola, ${patientName}</h2>
        <p>Tu solicitud de cancelación ha sido <strong style="color: #059669;">APROBADA</strong>.</p>
        <div style="background-color: #f0fdf4; border: 2px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #059669;">✅ Cita Cancelada</p>
          <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> ${appointment.doctor_name || 'Doctor asignado'}</p>
          ${adminNotes ? `<p style="margin-top:15px;padding:10px;background:#fff;border-radius:4px;"><strong>📝 Nota:</strong><br>${adminNotes}</p>` : ''}
        </div>
        <p style="color:#6b7280;">Si necesitas agendar una nueva cita, puedes hacerlo desde nuestra plataforma.</p>
      </div>`
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email aprobación enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error email aprobación:', error.message);
    return false;
  }
};

/**
 * Enviar email cuando se RECHAZA una cancelación
 */
const sendCancellationRejected = async (appointment, patientEmail, patientName, adminNotes) => {
  const date = new Date(appointment.start_time);
  const formattedDate = date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const msg = {
    to: patientEmail,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'Medical Booking' },
    subject: `❌ Solicitud Rechazada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Hola, ${patientName}</h2>
        <p>Tu solicitud de cancelación ha sido <strong style="color: #dc2626;">RECHAZADA</strong>.</p>
        <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #dc2626;">⚠️ Tu cita sigue programada</p>
          <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> ${appointment.doctor_name || 'Doctor asignado'}</p>
          ${adminNotes ? `<p style="margin-top:15px;padding:10px;background:#fff;border-radius:4px;"><strong>📝 Motivo:</strong><br>${adminNotes}</p>` : ''}
        </div>
        <p style="color:#6b7280;">Si no puedes asistir, contacta directamente con la clínica.</p>
      </div>`
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email rechazo enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error email rechazo:', error.message);
    return false;
  }
};

/**
 * Enviar email cuando se REASIGNA una cita
 */
const sendReassignment = async (oldAppointment, newAppointment, patientEmail, patientName, adminNotes) => {
  const oldDate = new Date(oldAppointment.start_time);
  const newDate = new Date(newAppointment.start_time);
  
  const formattedOldDate = oldDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedOldTime = oldDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const formattedNewDate = newDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedNewTime = newDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const msg = {
    to: patientEmail,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'Medical Booking' },
    subject: `🔄 Tu Cita Ha Sido Reasignada - Cita #${newAppointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Hola, ${patientName}</h2>
        <p>Tu cita ha sido <strong style="color: #2563eb;">REASIGNADA</strong>.</p>
        <div style="background-color: #eff6ff; border: 2px solid #2563eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:2px dashed #dbeafe;">
            <p style="font-size:16px;font-weight:bold;color:#dc2626;text-decoration:line-through;">❌ Fecha anterior:</p>
            <p><strong>📅 ${formattedOldDate}</strong></p>
            <p><strong>⏰ ${formattedOldTime}</strong></p>
          </div>
          <div>
            <p style="font-size:16px;font-weight:bold;color:#059669;">✅ Nueva fecha:</p>
            <p><strong>📅 ${formattedNewDate}</strong></p>
            <p><strong>⏰ ${formattedNewTime}</strong></p>
            <p><strong>👨‍⚕️ Doctor:</strong> ${newAppointment.doctor_name || 'Doctor asignado'}</p>
          </div>
          ${adminNotes ? `<p style="margin-top:15px;padding:10px;background:#fff;border-radius:4px;"><strong>📝 Nota:</strong><br>${adminNotes}</p>` : ''}
        </div>
        <p style="color:#6b7280;">Por favor, toma nota de la nueva fecha y hora.</p>
      </div>`
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email reasignación enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error email reasignación:', error.message);
    return false;
  }
};
/**
 * Enviar email cuando el ADMIN CANCELA DIRECTAMENTE (sin solicitud del paciente)
 */
const sendAdminCancellation = async (appointment, patientEmail, patientName, doctorName, adminNotes) => {
  const date = new Date(appointment.start_time);
  const formattedDate = date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const msg = {
    to: patientEmail,
    from: { 
      email: process.env.SENDGRID_FROM_EMAIL, 
      name: process.env.SENDGRID_FROM_NAME || 'Medical Booking' 
    },
    subject: `❌ Cita Cancelada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Hola, ${patientName}</h2>
        <p>Te informamos que tu cita ha sido <strong style="color: #dc2626;">CANCELADA</strong> por la administración de la clínica.</p>
        
        <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #dc2626;">❌ Cita Cancelada</p>
          <p><strong>📅 Fecha original:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> ${doctorName}</p>
          ${adminNotes ? `<p style="margin-top: 15px; padding: 10px; background-color: #fff; border-radius: 4px;"><strong>📝 Motivo:</strong><br>${adminNotes}</p>` : ''}
        </div>

        <p style="color: #6b7280; background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>ℹ️ Información importante:</strong><br>
          Lamentamos los inconvenientes. Puedes agendar una nueva cita desde nuestra plataforma cuando tengas disponibilidad.
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Notificación de cancelación
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email de cancelación por admin enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de cancelación por admin:', error.message);
    return false;
  }
};
/**
 * Enviar email cuando se CREA una cita
 */
const sendAppointmentCreated = async (appointment, patientEmail, patientName, doctorName) => {
  const date = new Date(appointment.start_time);
  const formattedDate = date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const msg = {
    to: patientEmail,
    from: { 
      email: process.env.SENDGRID_FROM_EMAIL, 
      name: process.env.SENDGRID_FROM_NAME || 'Medical Booking' 
    },
    subject: `✅ Cita Confirmada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">Hola, ${patientName}</h2>
        <p>Tu cita médica ha sido <strong style="color: #059669;">CONFIRMADA</strong>.</p>
        
        <div style="background-color: #f0fdf4; border: 2px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #059669;">✅ Cita Programada</p>
          <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> ${doctorName}</p>
          <p><strong>📝 Motivo:</strong> ${appointment.reason || 'Consulta general'}</p>
        </div>

        <p style="color: #6b7280; background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>ℹ️ Instrucciones:</strong><br>
          - Llega 15 minutos antes de tu cita<br>
          - Trae tu documento de identidad<br>
          - Si necesitas reagendar, hazlo desde la plataforma
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Confirmación de cita
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email de cita creada enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de cita creada:', error.message);
    return false;
  }
};
/**
 * Enviar email cuando el PACIENTE cancela su propia cita
 */
const sendPatientCancellation = async (appointment, patientEmail, patientName, doctorName) => {
  const date = new Date(appointment.start_time);
  const formattedDate = date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const msg = {
    to: patientEmail,
    from: { 
      email: process.env.SENDGRID_FROM_EMAIL, 
      name: process.env.SENDGRID_FROM_NAME || 'Medical Booking' 
    },
    subject: `❌ Cita Cancelada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Hola, ${patientName}</h2>
        <p>Tu cita ha sido <strong style="color: #dc2626;">CANCELADA</strong> exitosamente.</p>
        
        <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #dc2626;">❌ Cita Cancelada</p>
          <p><strong>📅 Fecha original:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> ${doctorName}</p>
        </div>

        <p style="color: #6b7280; background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>ℹ️ Información:</strong><br>
          Si necesitas agendar una nueva cita, puedes hacerlo desde nuestra plataforma en cualquier momento.
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Cancelación de cita
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email de cancelación por paciente enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de cancelación por paciente:', error.message);
    return false;
  }
};

module.exports = { 
  sendAppointmentReminder, 
  sendTwoHourReminder,
  sendCancellationApproved,
  sendCancellationRejected,
  sendReassignment,
  sendAdminCancellation,
  sendAppointmentCreated,     
  sendPatientCancellation,
  sendReminders     
};