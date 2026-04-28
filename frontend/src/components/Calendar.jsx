import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import api from '../services/api';

const Calendar = ({ userId, userRole, onEventClick, onViewDateChange }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && userRole) {
      fetchAppointments();
    }
  }, [userId, userRole]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = userRole === 'patient' ? { patient_id: userId } : 
                    userRole === 'doctor' ? { doctor_id: userId } : {};
      
      const response = await api.get('/appointments', { params });
      
      if (response.data.success && Array.isArray(response.data.data)) {
        const appointments = response.data.data;
        
        const calendarEvents = appointments.map((app) => {
          let color = '#3b82f6';
          if (app.status === 'completed') color = '#22c55e';
          if (app.status === 'cancelled') color = '#ef4444';

          // ✅ CONVERSIÓN DEFINITIVA: Eliminar cualquier indicio de zona horaria
          // "2026-04-27 08:00:00" → "2026-04-27T08:00:00"
          // "2026-04-27T08:00:00.000Z" → "2026-04-27T08:00:00"
          const cleanDate = (dateStr) => {
            return dateStr
              .replace('Z', '')           // Quitar la Z de UTC
              .replace(' ', 'T')          // Espacio → T
              .split('.')[0];             // Eliminar decimales
            };

          return {
            id: app.id,
            title: userRole === 'patient' ? `Dr. ${app.doctor_name}` : app.patient_name,
            start: cleanDate(app.start_time),  // Ej: "2026-04-27T08:00:00"
            end: cleanDate(app.end_time),
            backgroundColor: color,
            borderColor: color,
            extendedProps: { ...app }
          };
        });

        setEvents(calendarEvents);
      }
    } catch (error) {
      console.error('❌ Error cargando citas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (info) => {
    if (onEventClick) {
      onEventClick(info.event.extendedProps, info.event);
    }
  };

  const handleDateSelect = (selectInfo) => {
    if (onViewDateChange) {
      onViewDateChange(selectInfo);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <FullCalendar
          key={events.length}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          timeZone="local"           // ← CLAVE: interpreta fechas como hora local del navegador
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={events}
          editable={userRole === 'doctor' || userRole === 'admin'}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          allDaySlot={false}
          slotMinTime="08:00:00"    // ← Horario de oficina
          slotMaxTime="18:00:00"
          
          eventDrop={ async (info) => {
            const confirmed = window.confirm(
              `¿Deseas reprogramar esta cita para el ${info.event.start.toLocaleString()}?`
            );
            
            if (confirmed) {
              try {
                const newStart = info.event.start;
                const newEnd = new Date(newStart.getTime() + 30 * 60000);
                
                const payload = {
                  new_start_time: newStart.toISOString().slice(0, 16),
                  new_end_time: newEnd.toISOString().slice(0, 16)
                };
                
                const response = await api.put(`/appointments/${info.event.id}/reschedule`, payload);
                
                if (response.data.success) {
                  alert('✅ Cita reprogramada exitosamente');
                }
              } catch (error) {
                alert('❌ ' + (error.response?.data?.message || 'No se puede reprogramar'));
                info.revert();
              }
            } else {
              info.revert();
            }
          }}
          
          eventClick={handleEventClick}
          select={handleDateSelect}
          height="auto"
          nowIndicator={true}
        />
      )}
    </div>
  );
};

export default Calendar;