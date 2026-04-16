import api from './api';

export const appointmentsService = {
  // Obtener todas las citas
  getAll: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/appointments${queryParams ? `?${queryParams}` : ''}`);
  },

  // Obtener una cita por ID
  getById: (id) => {
    return api.get(`/appointments/${id}`);
  },

  // Crear nueva cita
  create: (data) => {
    return api.post('/appointments', data);
  },

  // Actualizar cita
  update: (id, data) => {
    return api.put(`/appointments/${id}`, data);
  },

  // Cancelar cita
  cancel: (id, reason = '') => {
    return api.put(`/appointments/${id}/cancel`, { cancellation_reason: reason });
  },

  // Reprogramar cita
  reschedule: (id, newStartTime, newEndTime) => {
    return api.put(`/appointments/${id}/reschedule`, {
      new_start_time: newStartTime,
      new_end_time: newEndTime
    });
  },

  // Eliminar cita (solo admin)
  delete: (id) => {
    return api.delete(`/appointments/${id}`);
  },

  // Obtener disponibilidad de médico
  getAvailability: (doctorId, date) => {
    return api.get(`/appointments/availability?doctor_id=${doctorId}&date=${date}`);
  }
};

export default appointmentsService;