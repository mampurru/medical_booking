import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import api from '../services/api';

// ✅ appointments = [] como valor por defecto
const Calendar = ({ 
  userId, 
  userRole, 
  appointments = [], 
  onEventClick, 
  onViewDateChange 
}) => {
  const [loading, setLoading] = useState(false);

  // ✅ Validación segura antes del map
  const events = Array.isArray(appointments) 
    ? appointments.map((app) => {
        let color = '#3b82f6';
        if (app.status === 'completed') color = '#22c55e';
        if (app.status === 'cancelled') color = '#ef4444';

        // const cleanDate = (dateStr) => {
        //   return dateStr
        //     .replace('Z', '')
        //     .replace(' ', 'T')
        //     .split('.')[0];
        // };
        const cleanDate = (dateStr) => {
          if (!dateStr) return '';
          
          // Crear objeto Date desde UTC
          const date = new Date(dateStr);
          
          // Formatear como string local para FullCalendar
          // Esto hace que FullCalendar muestre la hora correcta en Colombia
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
      })
    : [];

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
        events={events}
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