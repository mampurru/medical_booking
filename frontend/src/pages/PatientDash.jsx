import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Calendar from '../components/Calendar';
import AppointmentModal from '../components/AppointmentModal';
import api from '../services/api';

const PatientDash = () => {
  const { user } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nuevo flujo por pasos
  const [step, setStep] = useState(1); // 1: doctor+fecha, 2: slot, 3: motivo
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/doctors');
      if (response.data.success) setDoctors(response.data.data.doctors);
    } catch (error) {
      console.error('Error cargando médicos', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments');
      if (response.data.success) setAppointments(response.data.data);
    } catch (error) {
      console.error('Error cargando citas', error);
    }
  };

  const fetchAvailableSlots = async (doctorId, date) => {
    if (!doctorId || !date) return;
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelectedSlot(null);
    try {
      const res = await api.get(`/appointments/availability?doctor_id=${doctorId}&date=${date}`);
      if (res.data.success) {
        setAvailableSlots(res.data.data.available_slots || []);
      }
    } catch (error) {
      console.error('Error cargando slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Cuando cambia doctor o fecha, recargar slots
  const handleDoctorChange = (doctorId) => {
    setSelectedDoctor(doctorId);
    setSelectedSlot(null);
    if (doctorId && selectedDate) fetchAvailableSlots(doctorId, selectedDate);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (selectedDoctor && date) fetchAvailableSlots(selectedDoctor, date);
  };

  // Abrir modal desde el calendario
  const handleDateSelect = (selectInfo) => {
    const date = new Date(selectInfo.start);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setSelectedDoctor('');
    setSelectedSlot(null);
    setReason('');
    setStep(1);
    setShowNewAppointmentModal(true);
  };

  const handleEventClick = (appointmentData) => {
    setSelectedAppointment(appointmentData);
    setShowModal(true);
  };

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setIsSubmitting(true);
    try {
      const payload = {
        doctor_id: Number(selectedDoctor),
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        reason: reason
      };
      await api.post('/appointments', payload);
      alert('✅ Cita agendada correctamente');
      setShowNewAppointmentModal(false);
      await fetchAppointments();
      window.location.reload();
    } catch (error) {
      alert(error.response?.data?.message || 'Error al agendar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccess = () => {
    fetchAppointments();
    setShowModal(false);
  };

  const formatSlotTime = (isoString) => {
    const str = isoString.toString().replace('T', ' ').replace(/-/g, '/');
    const date = new Date(str);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const closeModal = () => {
    setShowNewAppointmentModal(false);
    setStep(1);
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedSlot(null);
    setReason('');
    setAvailableSlots([]);
  };

  const canGoToStep2 = selectedDoctor && selectedDate && availableSlots.length > 0;

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

      <Calendar
        userId={user?.id}
        userRole={user?.role}
        appointments={appointments}
        onEventClick={handleEventClick}
        onViewDateChange={handleDateSelect}
      />

      {showModal && selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          userRole={user?.role}
        />
      )}

      {/* Modal Nueva Cita - Flujo por pasos */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            
            {/* Header con pasos */}
            <div className="bg-blue-600 p-4">
              <h3 className="text-white text-lg font-semibold">Agendar Nueva Cita</h3>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${step >= n ? 'bg-white text-blue-600' : 'bg-blue-400 text-white'}`}>
                      {n}
                    </div>
                    {n < 3 && <div className={`h-0.5 w-8 ${step > n ? 'bg-white' : 'bg-blue-400'}`} />}
                  </div>
                ))}
                <span className="text-blue-100 text-xs ml-2">
                  {step === 1 ? 'Doctor y fecha' : step === 2 ? 'Horario' : 'Motivo'}
                </span>
              </div>
            </div>

            <form onSubmit={handleCreateAppointment} className="p-6 space-y-4">

              {/* PASO 1: Doctor y fecha */}
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Médico *</label>
                    <select
                      required
                      className="w-full border border-gray-300 rounded-lg p-2"
                      value={selectedDoctor}
                      onChange={(e) => handleDoctorChange(e.target.value)}
                    >
                      <option value="">Selecciona un especialista...</option>
                      {doctors.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          Dr. {doc.name} - {doc.specialty}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                    <input
                      type="date"
                      required
                      className="w-full border border-gray-300 rounded-lg p-2"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>

                  {/* Feedback de slots */}
                  {loadingSlots && (
                    <p className="text-sm text-blue-600 flex items-center gap-2">
                      <span className="animate-spin">⏳</span> Verificando disponibilidad...
                    </p>
                  )}
                  {!loadingSlots && selectedDoctor && selectedDate && availableSlots.length === 0 && (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                      ❌ No hay horarios disponibles ese día para este médico.
                    </p>
                  )}
                  {!loadingSlots && availableSlots.length > 0 && (
                    <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                      ✅ {availableSlots.length} horarios disponibles ese día.
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeModal}
                      className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button type="button"
                      disabled={!canGoToStep2}
                      onClick={() => setStep(2)}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
                      Siguiente →
                    </button>
                  </div>
                </>
              )}

              {/* PASO 2: Seleccionar slot */}
              {step === 2 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Selecciona un horario disponible *
                    </label>
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {availableSlots.map((slot, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium border transition
                            ${selectedSlot === slot
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                        >
                          {formatSlotTime(slot.start)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(1)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      ← Atrás
                    </button>
                    <button type="button"
                      disabled={!selectedSlot}
                      onClick={() => setStep(3)}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
                      Siguiente →
                    </button>
                  </div>
                </>
              )}

              {/* PASO 3: Motivo y confirmar */}
              {step === 3 && (
                <>
                  {/* Resumen */}
                  <div className="bg-blue-50 p-3 rounded-lg text-sm space-y-1">
                    <p><span className="font-medium">Doctor:</span> Dr. {doctors.find(d => d.id == selectedDoctor)?.name}</p>
                    <p><span className="font-medium">Fecha:</span> {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p><span className="font-medium">Hora:</span> {formatSlotTime(selectedSlot.start)} - {formatSlotTime(selectedSlot.end)}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                    <textarea
                      required
                      rows="3"
                      className="w-full border border-gray-300 rounded-lg p-2"
                      placeholder="Describe brevemente el motivo de tu consulta..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(2)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      ← Atrás
                    </button>
                    <button type="submit"
                      disabled={isSubmitting || !reason.trim()}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
                      {isSubmitting ? 'Agendando...' : '✅ Confirmar'}
                    </button>
                  </div>
                </>
              )}

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDash;