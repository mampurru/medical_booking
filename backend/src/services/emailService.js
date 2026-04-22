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

module.exports = { sendAppointmentReminder };