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

  // Debug props
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
      console.log('📦 response.data:', response.data);
      console.log('📋 appointments:', response.data.data?.appointments);
      console.log('✅ success?:', response.data.success);
      
      if (response.data.success && response.data.data?.length > 0) {
        const appointments = response.data.data;
        console.log(`🔢 Total de citas recibidas: ${appointments.length}`);
        
        const calendarEvents = appointments.map((app, index) => {
          console.log(`Cita ${index}:`, {
            id: app.id,
            start_time: app.start_time,
            end_time: app.end_time,
            doctor_name: app.doctor_name
          });
          
          let color = '#3b82f6';
          if (app.status === 'completed') color = '#22c55e';
          if (app.status === 'cancelled') color = '#ef4444';

          // Convertir fecha: "2024-04-13 08:00:00" → "2024-04-13T08:00:00"
          const startISO = app.start_time.replace(' ', 'T');
          const endISO = app.end_time.replace(' ', 'T');

          return {
            id: app.id,
            title: userRole === 'patient' ? `Dr. ${app.doctor_name}` : app.patient_name,
            start: startISO,
            end: endISO,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { ...app }
          };
        });

        console.log('🎨 Eventos finales para FullCalendar:', calendarEvents);
        setEvents(calendarEvents);
      } else {
        console.warn('⚠️ No hay citas o success es false');
      }
    } catch (error) {
      console.error('❌ Error cargando citas:', error);
      console.error('Detalles:', error.response?.data);
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
          key={JSON.stringify(events)}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={events}
          //editable={true}
          editable={userRole === 'doctor' || userRole === 'admin'}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          allDaySlot={false}

          // ✅ Nuevo evento cuando se mueve una cita
          eventDrop={ async (info) => {
            const confirmed = window.confirm(
              `¿Deseas reprogramar esta cita para el ${info.event.start.toLocaleString()}?`
            );
            
            if (confirmed) {
              try {
                const newStart = info.event.start;
                const newEnd = new Date(newStart.getTime() + 30 * 60000); // +30 min
                
                const payload = {
                  new_start_time: newStart.toISOString().slice(0, 16),
                  new_end_time: newEnd.toISOString().slice(0, 16)
                };
                
                console.log('🔄 Reprogramando cita:', info.event.id, payload);
                
                const response = await api.put(`/appointments/${info.event.id}/reschedule`, payload);
                
                if (response.data.success) {
                  alert('✅ Cita reprogramada exitosamente');
                }
              } catch (error) {
                alert('❌ ' + (error.response?.data?.message || 'No se puede reprogramar a esta hora'));
                info.revert(); // ← Regresa la cita a su posición original
              }
            } else {
              info.revert(); // ← Si cancela, regresa a la posición original
            }
          }}
          
          // ✅ AQUÍ FORZAMOS EL HORARIO VISUAL (8 AM a 6 PM)
          slotMinTime="08:00:00"
          slotMaxTime="18:00:00"
          
          eventClick={handleEventClick}
          select={handleDateSelect}
          height="auto"
          nowIndicator={true} // Muestra una línea roja en la hora actual
        />
      )}
    </div>
  );
};

export default Calendar;