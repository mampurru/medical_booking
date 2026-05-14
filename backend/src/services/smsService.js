const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Enviar recordatorio por SMS
 * @param {String} to - Número del paciente (ej: "+57300...")
 * @param {String} body - Mensaje
 */
exports.sendSmsReminder = async (to, body) => {
  if (!to) {
    console.warn('⚠️ No se envió SMS: El paciente no tiene teléfono registrado.');
    return false;
  }

  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    });

    console.log(`✅ SMS enviado a ${to}: ${body.substring(0, 30)}...`);
    return true;
  } catch (error) {
    console.error(`❌ Error enviando SMS a ${to}:`, error.message);
    return false;
  }
};