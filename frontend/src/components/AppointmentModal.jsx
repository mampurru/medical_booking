import React from 'react';
import api from '../services/api';

const AppointmentModal = ({ appointment, event, onClose, onSuccess, userRole }) => {
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancellationReason, setCancellationReason] = React.useState('');

  if (!appointment) return null;

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
  console.log('esta es la fecha :',formatDate(appointment.start_time),appointment.start_time)

  // Obtener estado en español
  const getStatusText = (status) => {
    const statuses = {
      scheduled: 'Programada',
      completed: 'Completada',
      cancelled: 'Cancelada',
      rescheduled: 'Reprogramada'
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Cancelar cita
  const handleCancel = async () => {
    if (!window.confirm('¿Estás seguro de cancelar esta cita?')) return;

    setIsCancelling(true);
    try {
      await api.put(`/appointments/${appointment.id}/cancel`, {
        cancellation_reason: cancellationReason
      });
      
      alert('✅ Cita cancelada exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || 'Error al cancelar la cita');
    } finally {
      setIsCancelling(false);
    }
  };
  const handleReschedule = () => {
    // Aquí podrías abrir un modal para seleccionar nueva fecha/hora
    alert('Función de reprogramación - En desarrollo');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <h3 className="text-white text-xl font-bold">Detalles de la Cita</h3>
          <p className="text-blue-100 text-sm mt-1">#{appointment.id}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Estado */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Estado:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(appointment.status)}`}>
              {getStatusText(appointment.status)}
            </span>
          </div>

          {/* Fecha y Hora */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-600 mb-1">Fecha y Hora</p>
            <p className="text-gray-900 font-semibold capitalize">{formatDate(appointment.start_time)}</p>
            <p className="text-gray-600 text-sm">
              Duración: 30 minutos
            </p>
          </div>

          {/* Información según el rol */}
          {userRole === 'patient' && appointment.doctorName && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-600 mb-1">Médico</p>
              <p className="text-gray-900 font-semibold">Dr. {appointment.doctorName}</p>
              {appointment.specialty && (
                <p className="text-blue-600 text-sm">{appointment.specialty}</p>
              )}
            </div>
          )}

          {userRole !== 'patient' && appointment.patientName && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-purple-600 mb-1">Paciente</p>
              <p className="text-gray-900 font-semibold">{appointment.patientName}</p>
              {appointment.patientEmail && (
                <p className="text-purple-600 text-sm">{appointment.patientEmail}</p>
              )}
              {appointment.patientPhone && (
                <p className="text-purple-600 text-sm">{appointment.patientPhone}</p>
              )}
            </div>
          )}

          {/* Motivo */}
          {appointment.reason && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Motivo de consulta</p>
              <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{appointment.reason}</p>
            </div>
          )}

          {/* Notas clínicas (solo si existen) */}
          {appointment.clinicalNotes && (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Notas clínicas</p>
              <p className="text-gray-900 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                {appointment.clinicalNotes}
              </p>
            </div>
          )}

          {/* Cancelar cita (solo si está programada y es paciente) */}
          {appointment.status === 'scheduled' && userRole === 'patient' && (
            <div className="border-t pt-4 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 mb-3 focus:ring-2 focus:ring-red-500"
                rows="2"
                placeholder="¿Por qué deseas cancelar?"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
              
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isCancelling ? 'Cancelando...' : 'Cancelar Cita'}
              </button>
              {userRole === 'doctor' && appointment.status === 'scheduled' && (
              <button
                onClick={handleReschedule}
                className="w-full mt-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
              🔄 Reprogramar Cita
              </button>
            )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
    
  );
};

export default AppointmentModal;