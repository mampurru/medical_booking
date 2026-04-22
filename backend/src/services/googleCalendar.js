const { google } = require('googleapis');

// 1. Configurar el cliente de Google
const auth = new google.auth.GoogleAuth({
  keyFile: null, // No usamos archivo, usamos el JSON directo
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  scopes: ['https://www.googleapis.com/auth/calendar.events']
});

const calendar = google.calendar({ version: 'v3', auth });

/**
 * Función para crear evento en Google Calendar
 */
const createCalendarEvent = async (appointment) => {
  try {
    // Definir el evento
    const event = {
      summary: `🏥 Cita Médica - ${appointment.patient_name}`,
      description: `Motivo: ${appointment.reason}\nDoctor ID: ${appointment.doctor_id}`,
      start: {
        dateTime: appointment.start_time, // Formato ISO esperado
        timeZone: 'America/Bogota', // 🇨🇴 Ajusta tu zona horaria si es diferente
      },
      end: {
        dateTime: appointment.end_time,   // Formato ISO esperado
        timeZone: 'America/Bogota',
      },
    };

    // Crear el evento en el calendario
    const createdEvent = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID, // Tu ID de la variable de entorno
      resource: event,
    });

    console.log(`✅ Evento creado en Google Calendar: ${createdEvent.data.htmlLink}`);
    return createdEvent.data;
  } catch (error) {
    console.error('❌ Error creando evento en Google Calendar:', error);
    // No lanzamos error para no romper el flujo de crear la cita en la BD
    return null;
  }
};

module.exports = { createCalendarEvent };