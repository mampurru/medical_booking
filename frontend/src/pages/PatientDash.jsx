import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Calendar from '../components/Calendar';
import AppointmentModal from '../components/AppointmentModal';
import api from '../services/api';
const handleCreateAppointment = async (e) => {
  e.preventDefault();
  console.log('🕐 Payload que se envía:', {
    start_time: formData.start_time,
    end_time: formData.end_time
  });}
const PatientDash = () => {
  const { user } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Formulario para nueva cita
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [formData, setFormData] = useState({
    doctor_id: '',
    reason: '',
    start_time: '',
    end_time: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar médicos
  React.useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await api.get('/doctors');
        if (response.data.success) {
          setDoctors(response.data.data.doctors);
        }
      } catch (error) {
        console.error('Error cargando médicos', error);
      }
    };
    fetchDoctors();
  }, []);

  // ✅ REEMPLAZA formatDateTimeLocal por esto:
  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Cuando se selecciona una fecha en el calendario
  const handleDateSelect = (selectInfo) => {
    const startDate = new Date(selectInfo.start);
    const endDate = new Date(startDate.getTime() + 30 * 60000); // +30 minutos exactos
    
    setFormData({
      doctor_id: '',
      reason: '',
      start_time: formatDateTimeLocal(startDate),
      end_time: formatDateTimeLocal(endDate) // ✅ Fin calculado automáticamente
    });
    setShowNewAppointmentModal(true);
  };

  const handleEventClick = (appointmentData, event) => {
    setSelectedAppointment(appointmentData);
    setShowModal(true);
  };

  // Crear nueva cita
  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        doctor_id: formData.doctor_id,
        start_time: formData.start_time,
        end_time: formData.end_time, // ✅ Usamos el end_time calculado
        reason: formData.reason
      };

      await api.post('/appointments', payload);
      alert('✅ Cita agendada correctamente');
      setShowNewAppointmentModal(false);
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Error al agendar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccess = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          👋 Hola, {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-gray-500 mt-2">
          Selecciona un horario en el calendario para agendar una nueva cita.
        </p>
      </div>

      {/* Calendario */}
      <Calendar
        userId={user?.id}
        userRole={user?.role}
        onEventClick={handleEventClick}
        onViewDateChange={handleDateSelect}
      />

      {/* Modal de Detalles de Cita */}
      {showModal && selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          userRole={user?.role}
        />
      )}

      {/* Modal para Nueva Cita */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="bg-blue-600 p-4">
              <h3 className="text-white text-lg font-semibold">Agendar Nueva Cita</h3>
            </div>
            
            <form onSubmit={handleCreateAppointment} className="p-6 space-y-4">
              {/* Médico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Médico *</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2"
                  value={formData.doctor_id}
                  onChange={(e) => setFormData({...formData, doctor_id: e.target.value})}
                >
                  <option value="">Selecciona un especialista...</option>
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>Dr. {doc.name} - {doc.specialty}</option>
                  ))}
                </select>
              </div>

              {/* Horario: Inicio editable, Fin bloqueado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio *</label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full border border-gray-300 rounded-lg p-2"
                    value={formData.start_time}
                    onChange={(e) => {
                      // Si cambia el inicio, recalcular el fin (+30 min)
                      const newStart = new Date(e.target.value);
                      const newEnd = new Date(newStart.getTime() + 30 * 60000);
                      setFormData({
                        ...formData,
                        start_time: formatDateTimeLocal(newStart),
                        end_time: formatDateTimeLocal(newEnd)
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin (Auto +30m)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    className="w-full border border-gray-300 rounded-lg p-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                    value={formData.end_time}
                  />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                <textarea
                  required
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Describe brevemente..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewAppointmentModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {isSubmitting ? 'Agendando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDash;