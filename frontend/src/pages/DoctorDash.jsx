import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Calendar from '../components/Calendar';
import api from '../services/api';

const DoctorDash = () => {
  const { user } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false); // ✅ Nuevo estado para modal de cancelación
  const [doctorId, setDoctorId] = useState(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Estados para el modal de cancelación
  const [cancelReason, setCancelReason] = useState('');
  const [cancelType, setCancelType] = useState('single'); // 'single' o 'full_day'
  const [isCanceling, setIsCanceling] = useState(false);

  // Obtener ID del doctor al cargar
  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        const response = await api.get('/auth/profile');
        if (response.data.success && response.data.data.profile) {
          setDoctorId(response.data.data.profile.id);
        }
      } catch (error) {
        console.error('Error cargando datos del doctor:', error);
      }
    };
    fetchDoctorData();
  }, []);

  // Cuando se hace clic en una cita
  const handleEventClick = (appointmentData, event) => {
    setSelectedAppointment(appointmentData);
    setClinicalNotes(appointmentData.clinical_notes || '');
    setShowModal(true);
  };

  // Guardar notas clínicas
  const handleSaveNotes = async () => {
    if (!selectedAppointment) return;
    
    setIsUpdating(true);
    try {
      await api.put(`/appointments/${selectedAppointment.id}`, {
        clinical_notes: clinicalNotes
      });
      alert('✅ Notas clínicas guardadas');
      setShowModal(false);
      window.location.reload();
    } catch (error) {
      alert('❌ Error al guardar notas');
    } finally {
      setIsUpdating(false);
    }
  };

  // Marcar cita como completada
  const handleMarkCompleted = async () => {
    if (!selectedAppointment) return;
    
    if (!window.confirm('¿Marcar esta cita como completada?')) return;
    
    try {
      await api.put(`/appointments/${selectedAppointment.id}`, {
        status: 'completed'
      });
      alert('✅ Cita marcada como completada');
      setShowModal(false);
      window.location.reload();
    } catch (error) {
      alert('❌ Error al actualizar');
    }
  };

  // ✅ ABRIR modal de solicitud de cancelación (en lugar de cancelar directo)
  const handleRequestCancel = () => {
    setCancelReason('');
    setCancelType('single');
    setShowCancelModal(true);
  };

  // ✅ ENVIAR solicitud de cancelación al backend
  const handleSubmitCancelRequest = async () => {
    if (!selectedAppointment || !cancelReason.trim()) return;
    
    setIsCanceling(true);
    try {
      const res = await api.post(`/appointments/${selectedAppointment.id}/cancel-request`, {
        reason: cancelReason.trim(),
        cancellation_type: cancelType
      });

      if (res.data.success) {
        alert(`✅ Solicitud enviada (${res.data.requested_count} cita(s)). Pendiente de aprobación del administrador.`);
        setShowCancelModal(false);
        setShowModal(false);
        window.location.reload();
      }
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || 'No se pudo enviar la solicitud'));
    } finally {
      setIsCanceling(false);
    }
  };

  // Cancelar cita (método antiguo - por si acaso, pero no se usa)
  const handleCancelAppointment = async () => {
    // Este método ya no se usa, pero lo dejamos por compatibilidad
    handleRequestCancel();
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          👨‍⚕️ Dr. {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-gray-500 mt-2">
          Gestiona tu agenda, agrega notas clínicas y reprograma citas arrastrándolas
        </p>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Citas Hoy</p>
          <p className="text-2xl font-bold text-blue-600">--</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">--</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Completadas</p>
          <p className="text-2xl font-bold text-green-600">--</p>
        </div>
      </div>

      {/* Calendario */}
      <Calendar
        userId={doctorId}
        userRole="doctor"
        onEventClick={handleEventClick}
        onViewDateChange={null}
      />

      {/* Modal de Detalles de Cita */}
      {showModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
              <h3 className="text-white text-xl font-bold">Detalles de la Cita</h3>
              <p className="text-green-100 text-sm mt-1">#{selectedAppointment.id}</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Estado */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Estado:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedAppointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  selectedAppointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {selectedAppointment.status === 'completed' ? 'Completada' :
                   selectedAppointment.status === 'cancelled' ? 'Cancelada' :
                   selectedAppointment.status === 'rescheduled' ? 'Reprogramada' : 'Programada'}
                </span>
              </div>

              {/* Fecha y Hora */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Fecha y Hora</p>
                <p className="text-gray-900 font-semibold capitalize">
                  {formatDate(selectedAppointment.start_time)}
                </p>
              </div>

              {/* Información del Paciente */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-600 mb-1">Paciente</p>
                <p className="text-gray-900 font-semibold text-lg">
                  {selectedAppointment.patient_name}
                </p>
                {selectedAppointment.patient_email && (
                  <p className="text-blue-600 text-sm">{selectedAppointment.patient_email}</p>
                )}
                {selectedAppointment.patient_phone && (
                  <p className="text-blue-600 text-sm">{selectedAppointment.patient_phone}</p>
                )}
              </div>

              {/* Motivo */}
              {selectedAppointment.reason && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Motivo de consulta</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedAppointment.reason}
                  </p>
                </div>
              )}

              {/* Notas Clínicas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Notas Clínicas / Diagnóstico
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows="5"
                  placeholder="Escribe aquí el diagnóstico, tratamiento, observaciones..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Estas notas serán visibles en el historial del paciente
                </p>
              </div>
            </div>

            {/* Footer con botones */}
            <div className="bg-gray-50 p-4 border-t space-y-3">
              {selectedAppointment.status === 'scheduled' && (
                <>
                  <button
                    onClick={handleMarkCompleted}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition"
                  >
                    ✅ Marcar como Completada
                  </button>
                  
                  <button
                    onClick={handleSaveNotes}
                    disabled={isUpdating}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition"
                  >
                    {isUpdating ? 'Guardando...' : '💾 Guardar Notas'}
                  </button>
                </>
              )}
              
              {/* ✅ Botón de Cancelar ahora abre el modal de solicitud */}
              {selectedAppointment.status === 'scheduled' && (
                <button
                  onClick={handleRequestCancel}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition"
                >
                  ❌ Solicitar Cancelación
                </button>
              )}
              
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL DE SOLICITUD DE CANCELACIÓN */}
      {showCancelModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-4">
              <h3 className="text-white text-lg font-bold">🛑 Solicitar Cancelación</h3>
              <p className="text-red-100 text-sm mt-1">
                Cita con {selectedAppointment.patient_name}
              </p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Tipo de cancelación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de cancelación:</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancellation_type"
                      value="single"
                      checked={cancelType === 'single'}
                      onChange={(e) => setCancelType(e.target.value)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">Solo esta cita</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancellation_type"
                      value="full_day"
                      checked={cancelType === 'full_day'}
                      onChange={(e) => setCancelType(e.target.value)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">Todas mis citas de este día (emergencia)</span>
                  </label>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Describe brevemente el motivo de la cancelación..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  El administrador revisará tu solicitud antes de aprobarla.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCanceling}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitCancelRequest}
                disabled={isCanceling || !cancelReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition flex items-center"
              >
                {isCanceling ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Enviando...
                  </>
                ) : (
                  'Enviar Solicitud'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDash;