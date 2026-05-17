import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAYS_ES = {
  Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles',
  Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo'
};

const DoctorSchedule = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAvailability(); }, []);

    const fetchAvailability = async () => {
        try {
            const res = await api.get('/doctors/me');
            const id = res.data.data.id;
            setDoctorId(id);
            const availRes = await api.get(`/doctor-availability/${id}`);
            if (availRes.data.success) setAvailability(availRes.data.data);
        } catch (error) {
            console.error('Error cargando horarios:', error);
        } finally {
            setLoading(false);
        }
    };

  const getDayData = (day) => availability.find(d => d.day_of_week === day) || {};
  const isActive = (day) => {
    const d = getDayData(day);
    return Object.keys(d).length > 0 && d.is_active !== false;
  };

  const toggleDay = (day) => {
    setAvailability(prev => {
      const exists = prev.find(d => d.day_of_week === day);
      if (exists) {
        return prev.map(d => d.day_of_week === day ? { ...d, is_active: !d.is_active } : d);
      }
      return [...prev, {
        day_of_week: day, start_time: '08:00', end_time: '18:00',
        lunch_start: '12:00', lunch_end: '13:00', is_active: true
      }];
    });
  };

  const handleChange = (day, field, value) => {
    setAvailability(prev => {
      const exists = prev.find(d => d.day_of_week === day);
      if (exists) return prev.map(d => d.day_of_week === day ? { ...d, [field]: value } : d);
      return [...prev, { day_of_week: day, [field]: value, is_active: true }];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const activeOnly = availability.filter(d => d.is_active !== false);
      await api.put('/doctor-availability/update', { availability: activeOnly });
      alert('✅ Horario guardado exitosamente');
      fetchAvailability();
    } catch (error) {
      alert('❌ Error guardando horario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Mi Horario de Trabajo</h1>
        <p className="text-gray-500 mb-6">Configura los días y horas en que recibes pacientes.</p>

        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {DAYS.map(day => {
            const data = getDayData(day);
            const active = isActive(day);

            return (
              <div key={day} className="p-5">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleDay(day)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className={`text-lg font-semibold ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                    {DAYS_ES[day]}
                  </span>
                  {!active && <span className="text-sm text-gray-400 italic">— No disponible</span>}
                </label>

                {active && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-8">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Entrada</label>
                      <input type="time" value={data.start_time || '08:00'}
                        onChange={e => handleChange(day, 'start_time', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Salida</label>
                      <input type="time" value={data.end_time || '18:00'}
                        onChange={e => handleChange(day, 'end_time', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Almuerzo</label>
                      <div className="flex gap-2 items-center">
                        <input type="time" value={data.lunch_start || '12:00'}
                          onChange={e => handleChange(day, 'lunch_start', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                        <span className="text-gray-400 text-sm">a</span>
                        <input type="time" value={data.lunch_end || '13:00'}
                          onChange={e => handleChange(day, 'lunch_end', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg p-2 text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition-colors">
          {saving ? 'Guardando...' : 'Guardar Horario'}
        </button>
      </div>
    </div>
  );
};

export default DoctorSchedule;