const sgMail = require('@sendgrid/mail');

// Configurar SendGrid con la API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Enviar recordatorio de cita por email
 * @param {Object} appointment - Datos de la cita
 * @param {String} patientEmail - Email del paciente
 * @param {String} patientName - Nombre del paciente
 */
const sendAppointmentReminder = async (appointment, patientEmail, patientName) => {
  // Formatear fecha y hora
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
    subject: `📅 Recordatorio de cita médica - ${formattedDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Hola, ${patientName}</h2>
        <p>Este es un recordatorio de tu próxima cita médica:</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍️ Doctor ID:</strong> ${appointment.doctor_id}</p>
          <p><strong>📝 Motivo:</strong> ${appointment.reason || 'Consulta general'}</p>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Por favor llega 15 minutos antes de tu cita. Si necesitas reagendar, ingresa a nuestra plataforma.
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Recordatorio automático
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email enviado exitosamente a ${patientEmail} para la cita ID ${appointment.id}`);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar email:', error.response ? error.response.body : error.message);
    return false;
  }
};
/**
 * Enviar recordatorio de 2 horas antes
 */
const sendTwoHourReminder = async (appointment, patientEmail, patientName) => {
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
    subject: `⏰ ÚLTIMO RECORDATORIO - Cita en 2 horas`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Hola, ${patientName}</h2>
        <p style="font-size: 16px; font-weight: bold;">Tu cita es HOY en 2 horas:</p>
        
        <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍️ Doctor ID:</strong> ${appointment.doctor_id}</p>
          <p><strong>📝 Motivo:</strong> ${appointment.reason || 'Consulta general'}</p>
        </div>

        <p style="color: #dc2626; font-size: 16px; font-weight: bold;">
          ⚠️ Por favor prepara tu documentación y llega 15 minutos antes.
        </p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email 2h enviado a ${patientEmail} para cita ID ${appointment.id}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email 2h:', error.message);
    return false;
  }
};
/**
 * Enviar email cuando se APRUEBA una cancelación
 */
const sendCancellationApproved = async (appointment, patientEmail, patientName, adminNotes) => {
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
    subject: `✅ Cancelación Aprobada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669;">Hola, ${patientName}</h2>
        <p>Tu solicitud de cancelación ha sido <strong style="color: #059669;">APROBADA</strong>.</p>
        
        <div style="background-color: #f0fdf4; border: 2px solid #059669; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #059669;">✅ Cita Cancelada</p>
          <p><strong>📅 Fecha original:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍️ Doctor:</strong> ${appointment.doctor_name || 'Doctor asignado'}</p>
          ${adminNotes ? `<p style="margin-top: 15px; padding: 10px; background-color: #fff; border-radius: 4px;"><strong>📝 Nota del administrador:</strong><br>${adminNotes}</p>` : ''}
        </div>

        <p style="color: #6b7280;">
          Si necesitas agendar una nueva cita, puedes hacerlo desde nuestra plataforma en cualquier momento.
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Confirmación de cancelación
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email de cancelación aprobada enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de cancelación aprobada:', error.message);
    return false;
  }
};

/**
 * Enviar email cuando se RECHAZA una cancelación
 */
const sendCancellationRejected = async (appointment, patientEmail, patientName, adminNotes) => {
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
    subject: `❌ Solicitud de Cancelación Rechazada - Cita #${appointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Hola, ${patientName}</h2>
        <p>Tu solicitud de cancelación ha sido <strong style="color: #dc2626;">RECHAZADA</strong>.</p>
        
        <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #dc2626;">⚠️ Tu cita sigue programada</p>
          <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
          <p><strong>⏰ Hora:</strong> ${formattedTime}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> ${appointment.doctor_name || 'Doctor asignado'}</p>
          ${adminNotes ? `<p style="margin-top: 15px; padding: 10px; background-color: #fff; border-radius: 4px;"><strong>📝 Motivo del rechazo:</strong><br>${adminNotes}</p>` : ''}
        </div>

        <p style="color: #6b7280;">
          Por favor, si no puedes asistir, contacta directamente con la clínica para buscar una solución.
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Notificación de rechazo
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email de cancelación rechazada enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de cancelación rechazada:', error.message);
    return false;
  }
};

/**
 * Enviar email cuando se REASIGNA una cita
 */
const sendReassignment = async (oldAppointment, newAppointment, patientEmail, patientName, adminNotes) => {
  const oldDate = new Date(oldAppointment.start_time);
  const newDate = new Date(newAppointment.start_time);
  
  const formattedOldDate = oldDate.toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const formattedOldTime = oldDate.toLocaleTimeString('es-ES', { 
    hour: '2-digit', minute: '2-digit' 
  });
  
  const formattedNewDate = newDate.toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const formattedNewTime = newDate.toLocaleTimeString('es-ES', { 
    hour: '2-digit', minute: '2-digit' 
  });

  const msg = {
    to: patientEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME || 'Medical Booking'
    },
    subject: `🔄 Tu Cita Ha Sido Reasignada - Cita #${newAppointment.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Hola, ${patientName}</h2>
        <p>Tu cita ha sido <strong style="color: #2563eb;">REASIGNADA</strong> a una nueva fecha y hora.</p>
        
        <div style="background-color: #eff6ff; border: 2px solid #2563eb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px dashed #dbeafe;">
            <p style="font-size: 16px; font-weight: bold; color: #dc2626; text-decoration: line-through;">
              ❌ Fecha anterior:
            </p>
            <p><strong>📅 ${formattedOldDate}</strong></p>
            <p><strong>⏰ ${formattedOldTime}</strong></p>
          </div>
          
          <div>
            <p style="font-size: 16px; font-weight: bold; color: #059669;">
              ✅ Nueva fecha:
            </p>
            <p><strong>📅 ${formattedNewDate}</strong></p>
            <p><strong>⏰ ${formattedNewTime}</strong></p>
            <p><strong>👨‍️ Doctor:</strong> ${newAppointment.doctor_name || 'Doctor asignado'}</p>
          </div>
          
          ${adminNotes ? `<p style="margin-top: 15px; padding: 10px; background-color: #fff; border-radius: 4px;"><strong>📝 Nota:</strong><br>${adminNotes}</p>` : ''}
        </div>

        <p style="color: #6b7280;">
          Por favor, toma nota de la nueva fecha y hora. Si tienes inconvenientes, contáctanos.
        </p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <p style="font-size: 12px; color: #9ca3af;">
            Medical Booking System - Reasignación de cita
          </p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email de reasignación enviado a ${patientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email de reasignación:', error.message);
    return false;
  }
};

module.exports = { 
  sendAppointmentReminder, 
  sendTwoHourReminder,
  sendCancellationApproved,
  sendCancellationRejected,
  sendReassignment
};