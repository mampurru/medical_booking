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
    console.log('🔍 DEBUG Calendar Props:', { userId, userRole });
  }, [userId, userRole]);

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
      
      console.log('📡 Llamando API con params:', params);
      
      const response = await api.get('/appointments', { params });
      
      console.log('✅ Respuesta completa:', response);
      
      if (response.data.success && response.data.data?.length > 0) {
        const appointments = response.data.data;
        console.log(`🔢 Total de citas recibidas: ${appointments.length}`);
        
        const calendarEvents = appointments.map((app, index) => {
          let color = '#3b82f6';
          if (app.status === 'completed') color = '#22c55e';
          if (app.status === 'cancelled') color = '#ef4444';

          // ✅ ELIMINAR .000Z para que FullCalendar interprete como HORA LOCAL
          const startISO = app.start_time
            .replace(' ', 'T')
            .replace(/\.000Z$/, '');  // Elimina .000Z del final
          
          const endISO = app.end_time
            .replace(' ', 'T')
            .replace(/\.000Z$/, '');

          console.log(`🕐 Cita ${index}:`, {
            id: app.id,
            original: app.start_time,
            convertido: startISO
          });

          return {
            id: app.id,
            title: userRole === 'patient' ? `Dr. ${app.doctor_name}` : app.patient_name,
            start: startISO,  // Ej: "2026-04-27T08:00:00" (sin Z)
            end: endISO,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { ...app }
          };
        });

        console.log('🎨 Eventos finales:', calendarEvents);
        setEvents(calendarEvents);
      } else {
        console.warn('⚠️ No hay citas o success es false');
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
          timeZone="local"          // ← IMPORTANTE: interpreta fechas como hora local
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
          slotMinTime="08:00:00"
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