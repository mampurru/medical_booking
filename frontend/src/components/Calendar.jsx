import React, { useState } from 'react'; // ✅ Quitar useEffect si no lo usas para otra cosa
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';

// ✅ Recibir appointments como prop
const Calendar = ({ userId, userRole, appointments, onEventClick, onViewDateChange }) => {
  const [loading, setLoading] = useState(false); // Ya no necesitas loading para fetch

  // ✅ Elimina TODO el useEffect y fetchAppointments de aquí

  // Convierte appointments al formato de FullCalendar
  const events = appointments.map((app) => {
    let color = '#3b82f6';
    if (app.status === 'completed') color = '#22c55e';
    if (app.status === 'cancelled') color = '#ef4444';

    const cleanDate = (dateStr) => {
      return dateStr
        .replace('Z', '')
        .replace(' ', 'T')
        .split('.')[0];
    };

    return {
      id: app.id,
      title: userRole === 'patient' ? `Dr. ${app.doctor_name}` : app.patient_name,
      start: cleanDate(app.start_time),
      end: cleanDate(app.end_time),
      backgroundColor: color,
      borderColor: color,
      extendedProps: { ...app }
    };
  });

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
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}  // ✅ Usar events directamente
        timeZone="local"
        locale={esLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        editable={userRole === 'doctor' || userRole === 'admin'}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="18:00:00"
        
        eventDrop={async (info) => {
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
    </div>
  );
};

export default Calendar;