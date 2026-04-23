const { google } = require('googleapis');

const calendarService = {
  getClient: () => {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    return new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/calendar.events']
    });
  },

  createCalendarEvent: async (appointment) => {
    try {
      const auth = await calendarService.getClient();
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary: `🏥 Cita Médica - ${appointment.patient_name || 'Paciente'}`,
        description: `Motivo: ${appointment.reason || 'Consulta General'}\nDoctor ID: ${appointment.doctor_id}`,
        start: {
          dateTime: new Date(appointment.start_time).toISOString(),
          timeZone: 'America/Bogota',
        },
        end: {
          dateTime: new Date(appointment.end_time).toISOString(),
          timeZone: 'America/Bogota',
        },
      };

      const response = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        requestBody: event,
      });

      console.log(`✅ Evento creado en Google Calendar: ${response.data.htmlLink}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error creando evento en Google Calendar:', error);
      return null;
    }
  }
};

module.exports = calendarService;