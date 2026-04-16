import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AdminDash = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);

  // Cargar estadísticas y datos al iniciar
  useEffect(() => {
    fetchData();
  }, []);
  // Cargar usuarios pendientes cuando se active la pestaña
  useEffect(() => {
    if (activeTab === 'pending') {
      const loadPendingUsers = async () => {
        try {
          const res = await api.get('/admin/users/pending');
          console.log('📋 Pendientes recibidos:', res.data); // Debug
          if (res.data.success) {
            setPendingUsers(res.data.users || []);
          }
        } catch (error) {
          console.error('Error cargando pendientes:', error);
          setPendingUsers([]);
        }
      };
      loadPendingUsers();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
        // Estadísticas
        try {
        const statsRes = await api.get('/admin/stats');
        if (statsRes.data.success) {
            setStats(statsRes.data.data);
        }
        } catch (error) {
        console.log('Stats no disponibles');
        setStats({
            total_users: 0,
            appointments_today: 0,
            appointments_pending: 0,
            active_doctors: 0
        });
        }

        // Usuarios
        try {
        const usersRes = await api.get('/admin/users');
        if (usersRes.data.success) {
            setUsers(usersRes.data.users || []);
        }
        } catch (error) {
        console.log('Usuarios no disponibles');
        setUsers([]);
        }

        // Citas
        try {
        const appointmentsRes = await api.get('/appointments');
        if (appointmentsRes.data.success) {
            const apps = appointmentsRes.data.data?.appointments || appointmentsRes.data.data || [];
            setAppointments(apps);
        }
        } catch (error) {
        console.log('Citas no disponibles');
        setAppointments([]);
        }
    } catch (error) {
        console.error('Error general:', error);
    } finally {
        setLoading(false);
    }
  };
  // Eliminar usuario
  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Eliminar permanentemente a ${userName}?`)) return;
    
    try {
      await api.delete(`/admin/users/${userId}`);
      alert('✅ Usuario eliminado');
      fetchData();
    } catch (error) {
      alert('❌ Error al eliminar: ' + error.response?.data?.message);
    }
  };

  // Eliminar cita
  const handleDeleteAppointment = async (appointmentId) => {
    if (!window.confirm('¿Eliminar esta cita permanentemente?')) return;
    
    try {
      await api.delete(`/appointments/${appointmentId}`);
      alert('✅ Cita eliminada');
      fetchData();
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.message);
    }
  };
  // Aprobar usuario pendiente
  const handleApproveUser = async (userId, userName) => {
    if (!window.confirm(`¿Aprobar a ${userName}?`)) return;
    
    try {
      await api.put(`/admin/users/${userId}/approve`);
      alert('✅ Usuario aprobado');
      // Actualizar lista localmente
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      // Refrescar stats generales
      fetchData();
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.message);
    }
  };

  // Rechazar usuario pendiente
  const handleRejectUser = async (userId, userName) => {
    if (!window.confirm(`¿Rechazar y eliminar a ${userName}?`)) return;
    
    try {
      await api.delete(`/admin/users/${userId}/reject`);
      alert('🗑️ Usuario rechazado y eliminado');
      // Actualizar lista localmente
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.message);
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Badge de rol
  const RoleBadge = ({ role }) => {
    const colors = {
      patient: 'bg-blue-100 text-blue-800',
      doctor: 'bg-green-100 text-green-800',
      admin: 'bg-purple-100 text-purple-800'
    };
    const labels = { patient: 'Paciente', doctor: 'Doctor', admin: 'Admin' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[role]}`}>
        {labels[role]}
      </span>
    );
  };

  // Badge de estado de cita
  const StatusBadge = ({ status }) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-yellow-100 text-yellow-800'
    };
    const labels = {
      scheduled: 'Programada', completed: 'Completada',
      cancelled: 'Cancelada', rescheduled: 'Reprogramada'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };
  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const doctorData = Object.fromEntries(formData);
    
    try {
      await api.post('/admin/doctors', doctorData);
      alert('✅ Doctor creado');
      e.target.reset();
      fetchData(); // Refrescar datos
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.message);
    }
  };
  
  // Filtrar usuarios
  const filteredUsers = filterRole === 'all' 
    ? users 
    : users.filter(u => u.role === filterRole);

  // Filtrar citas
  const filteredAppointments = filterDate 
    ? appointments.filter(a => a.start_time.startsWith(filterDate))
    : appointments;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">⚙️ Panel de Administración</h1>
              <p className="text-gray-500 text-sm">Gestión completa del sistema</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                Hola, {user?.firstName} {user?.lastName}
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                Administrador
              </span>
            </div> 
            <div>
            <button 
              onClick={() => setShowDoctorForm(!showDoctorForm)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
              ➕ Nuevo Doctor
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
              { id: 'users', label: '👥 Usuarios', icon: '👥' },
              { id: 'appointments', label: '📅 Citas', icon: '📅' },
              { id: 'reports', label: '📈 Reportes', icon: '📈' },
              { id: 'settings', label: '⚙️ Config', icon: '⚙️' },
              { id: 'pending', label: '⏳ Pendientes', icon: '⏳' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* 📊 DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-600">Total Usuarios</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.total_users || 0}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-600">Citas Hoy</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.appointments_today || 0}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-600">Citas Pendientes</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.appointments_pending || 0}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-600">Doctores Activos</p>
                    <p className="text-3xl font-bold text-green-600">{stats.active_doctors || 0}</p>
                  </div>
                </div>

                {/* Actividad Reciente */}
                <div className="bg-white rounded-xl shadow-sm border">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-800">🕐 Actividad Reciente</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {appointments.slice(0, 5).map(app => (
                        <div key={app.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-gray-800">{app.patient_name}</p>
                            <p className="text-sm text-gray-500">
                              con {app.doctor_name} • {formatDate(app.start_time)}
                            </p>
                          </div>
                          <StatusBadge status={app.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 👥 USUARIOS */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Filtrar por rol:</label>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="patient">Pacientes</option>
                    <option value="doctor">Doctores</option>
                    <option value="admin">Administradores</option>
                  </select>
                  <button
                    onClick={fetchData}
                    className="ml-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    🔄 Actualizar
                  </button>
                </div>

                {/* Tabla de Usuarios */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Usuario</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rol</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Registrado</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{u.first_name} {u.last_name}</p>
                            {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                          <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(u.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.first_name)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                              >
                                🗑️ Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 📅 CITAS */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Fecha:</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => setFilterDate('')}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={fetchData}
                    className="ml-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    🔄 Actualizar
                  </button>
                </div>

                {/* Tabla de Citas */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Paciente</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doctor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha/Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Motivo</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredAppointments.map(app => (
                        <tr key={app.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{app.patient_name}</p>
                            <p className="text-xs text-gray-500">{app.patient_email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{app.doctor_name}</p>
                            <p className="text-xs text-gray-500">{app.specialty}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(app.start_time)}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {app.reason || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteAppointment(app.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 📈 REPORTES */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">📊 Reportes Avanzados</h3>
                  <p className="text-gray-500">Próximamente: Gráficos de ingresos, tiempos de espera, especialidades más solicitadas...</p>
                  <div className="mt-4 flex justify-center gap-4">
                    <button className="px-4 py-2 bg-gray-200 rounded-lg text-sm" disabled>Por Médico</button>
                    <button className="px-4 py-2 bg-gray-200 rounded-lg text-sm" disabled>Por Fecha</button>
                    <button className="px-4 py-2 bg-gray-200 rounded-lg text-sm" disabled>Exportar CSV</button>
                  </div>
                </div>
              </div>
            )}

            {/* ⚙️ CONFIGURACIÓN */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ Configuración del Sistema</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duración estándar de consulta (minutos)
                      </label>
                      <input
                        type="number"
                        defaultValue={30}
                        className="w-full max-w-xs border rounded-lg px-3 py-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Horario de atención
                      </label>
                      <div className="flex items-center gap-4">
                        <input type="time" defaultValue="08:00" className="border rounded-lg px-3 py-2" />
                        <span className="text-gray-500">a</span>
                        <input type="time" defaultValue="18:00" className="border rounded-lg px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Especialidades disponibles
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['Medicina General', 'Cardiología', 'Pediatría', 'Dermatología'].map(spec => (
                          <span key={spec} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                            {spec} ✕
                          </span>
                        ))}
                        <button className="px-3 py-1 border border-dashed rounded-full text-sm text-gray-500 hover:text-purple-600">
                          + Agregar
                        </button>
                      </div>
                    </div>

                    <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                      💾 Guardar Cambios
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/*Contenido de la pestaña:*/} 
            {activeTab === 'pending' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Usuarios pendientes de aprobación</h3>
                
                {pendingUsers.length === 0 ? (
                  <p className="text-gray-500">✅ No hay usuarios pendientes</p>
                ) : (
                  <table className="w-full bg-white rounded-xl shadow-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">Usuario</th>
                        <th className="px-4 py-3 text-left">Email</th>
                        <th className="px-4 py-3 text-left">Rol</th>
                        <th className="px-4 py-3 text-left">Registrado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.map(u => (
                        <tr key={u.id} className="border-t">
                          <td className="px-4 py-3">{u.first_name} {u.last_name}</td>
                          <td className="px-4 py-3">{u.email}</td>
                          <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => handleApproveUser(u.id)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              ✅ Aprobar
                            </button>
                            <button
                              onClick={() => handleRejectUser(u.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              ❌ Rechazar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
        {showDoctorForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <form onSubmit={handleCreateDoctor} className="bg-white p-6 rounded-xl shadow-lg w-96">
              <h3 className="text-lg font-semibold mb-4">Crear Nuevo Doctor</h3>
              <input name="firstName" placeholder="Nombre" required className="w-full mb-2 p-2 border rounded" />
              <input name="lastName" placeholder="Apellido" required className="w-full mb-2 p-2 border rounded" />
              <input name="email" type="email" placeholder="Email" required className="w-full mb-2 p-2 border rounded" />
              <input name="password" type="password" placeholder="Contraseña temporal" required className="w-full mb-2 p-2 border rounded" />
              <input name="specialty" placeholder="Especialidad" required className="w-full mb-2 p-2 border rounded" />
              <input name="license_number" placeholder="N° Licencia" required className="w-full mb-4 p-2 border rounded" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowDoctorForm(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded">Crear</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDash;