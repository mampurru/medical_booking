import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { io } from 'socket.io-client';

const AdminDash = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Referencia para evitar problemas de estado antiguo (stale state)
  const activeTabRef = React.useRef(activeTab);
  React.useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  
  // DETECTAR TIPO DE ADMIN
  const isAdminSuper = user?.role === 'super_admin';
  const isAdminGeneral = user?.role === 'admin_general';
  const isAdminEspecialidad = user?.role === 'admin_especialidad';
  const userSpecialtyId = user?.specialty_id;

  const [cancellationRequests, setCancellationRequests] = useState([]);
  const [activeCancelTab, setActiveCancelTab] = useState('pending'); // 'pending' o 'history'
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [specialties, setSpecialties] = useState([]);

  // ... estados existentes ...
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveNote, setApproveNote] = useState('');
  const [reassignData, setReassignData] = useState({ new_doctor_id: '', new_start_time: '', note: '' });
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [cancellationReports, setCancellationReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Función para mostrar notificación
  const showToast = (message) => {
    console.log('📢 Mostrando toast:', message);
    
    // Remover toast anterior si existe
    const existing = document.getElementById('admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-4 rounded-lg shadow-2xl z-[9999] flex items-center gap-3';
    toast.innerHTML = `
      <span class="text-2xl">🔔</span>
      <div>
        <p class="font-bold">Nueva Solicitud</p>
        <p class="text-sm">${message}</p>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  };
  // 🔌 CONEXIÓN SOCKET.IO CON NOTIFICACIONES
  useEffect(() => {
    if (!user?.id) return;

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const SOCKET_URL = API_URL.replace('/api', '');

    console.log('🔌 Conectando a Socket.io:', SOCKET_URL);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket conectado:', newSocket.id);
      newSocket.emit('join-admin-room', user.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket:', error.message);
    });

    // Escuchar nueva solicitud de cancelación
    newSocket.on('new-cancellation-request', (data) => {
      console.log('🔔 [SOCKET] Recibida solicitud:', data);
      
      // Agregar a la lista de notificaciones (al principio)
      setNotifications(prev => [data, ...prev]);
      
      // Si estamos en la pestaña de cancelaciones, recargar
      if (activeTab === 'cancellations') {
        loadCancellationRequests();
      }
    });

    return () => {
      console.log('🔌 Desconectando socket...');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [user?.id, activeTab]);

  useEffect(() => {
    if (activeTab === 'cancellation_reports') {
      loadCancellationReports();
    }
  }, [activeTab]);

  // Cargar estadísticas y datos al iniciar
  useEffect(() => {
    fetchData();
    // Cargar especialidades para el formulario de doctores
    if (isAdminSuper || isAdminGeneral) {
      loadSpecialties();
    }
  }, []);

  // Cargar usuarios pendientes cuando se active la pestaña
  useEffect(() => {
    if (activeTab === 'pending' && (isAdminSuper || isAdminGeneral)) {
      loadPendingUsers();
    }
  }, [activeTab, isAdminSuper, isAdminGeneral]);

  const loadCancellationRequests = async () => {
    try {
      const res = await api.get('/admin/cancellation-requests');
      if (res.data.success) {
        setCancellationRequests(res.data.requests || []);
      }
    } catch (error) {
      console.error('Error cargando cancelaciones:', error);
      setCancellationRequests([]);
    }
  };
  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setRejectNote('');
    setShowRejectModal(true);
  };
  const confirmReject = async () => {
  if (!selectedRequest) return;
  
  setIsProcessing(true);
    try {
      const res = await api.post(`/admin/cancellation-requests/${selectedRequest.id}/reject`, {
        admin_notes: rejectNote || ''
      });
      
      if (res.data.success) {
        alert('❌ Cancelación rechazada. La cita sigue programada.');
        setShowRejectModal(false);
        loadCancellationRequests(); // Recargar lista (esto la quita de pendientes)
      }
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || 'No se pudo rechazar'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Cargar cuando se active la pestaña de cancelaciones
  useEffect(() => {
    if (activeTab === 'cancellations') {
      loadCancellationRequests();
      //  Auto-refresh cada 30 segundos
      const interval = setInterval(() => {
        loadCancellationRequests();
      }, 30000); // 30000 ms = 30 segundos
      
      // Limpiar el intervalo al desmontar
      return () => clearInterval(interval);
  
    }
  }, [activeTab]);

  const loadCancellationReports = async () => {
    setReportsLoading(true);
    try {
      const res = await api.get('/admin/cancellation-reports');
      if (res.data.success) {
        setCancellationReports(res.data.reports || []);
      }
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setReportsLoading(false);
    }
  };

  const loadSpecialties = async () => {
    try {
      const res = await api.get('/admin/specialties');
      if (res.data.success) {
        setSpecialties(res.data.specialties);
      }
    } catch (error) {
      console.error('Error cargando especialidades:', error);
    }
  };

  const loadPendingUsers = async () => {
    try {
      const res = await api.get('/admin/users/pending');
      if (res.data.success) {
        setPendingUsers(res.data.users || []);
      }
    } catch (error) {
      console.error('Error cargando pendientes:', error);
      setPendingUsers([]);
    }
  };

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

      // Usuarios (el backend ya filtra por especialidad si es admin_especialidad)
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
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
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
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.message);
    }
  };

  // 1. Abrir Modal de Aprobación
  const openApproveModal = (request) => {
    setSelectedRequest(request);
    setApproveNote('');
    setShowApproveModal(true);
  };

  // 2. Confirmar Aprobación (Con nota)
  const confirmApprove = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    try {
      const res = await api.post(`/admin/cancellation-requests/${selectedRequest.id}/approve`, {
        admin_notes: approveNote
      });
      if (res.data.success) {
        alert('✅ Cancelación aprobada.');
        setShowApproveModal(false);
        loadCancellationRequests();
      }
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || 'No se pudo aprobar'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Abrir Modal de Reasignación
  const openReassignModal = async (request) => {
    setSelectedRequest(request);
    setReassignData({ new_doctor_id: '', new_start_time: '', note: '' });
    
    // Cargar doctores de la misma especialidad (o todos si es admin general)
    try {
      // Asumiendo que tienes un endpoint para listar doctores, si no, usa /admin/users filtrado
      // Por ahora, usaremos una llamada genérica o la que tengas para doctores
      // Si no tienes un endpoint específico, podemos usar /admin/users?role=doctor
      const res = await api.get('/admin/users'); 
      if (res.data.success) {
        const doctors = res.data.users.filter(u => u.role === 'doctor');
        // Filtrar por especialidad si es necesario (lógica simple)
        setAvailableDoctors(doctors);
      }
    } catch (error) {
      console.error('Error cargando doctores:', error);
    }
    
    setShowReassignModal(true);
  };

  // 4. Confirmar Reasignación
  const confirmReassign = async () => {
    if (!selectedRequest || !reassignData.new_doctor_id || !reassignData.new_start_time) {
      alert('Por favor selecciona un doctor y una fecha/hora.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api.post(`/admin/cancellation-requests/${selectedRequest.id}/reassign`, {
        new_doctor_id: reassignData.new_doctor_id,
        new_start_time: reassignData.new_start_time,
        admin_notes: reassignData.note
      });

      if (res.data.success) {
        alert('✅ Cita reasignada correctamente.');
        setShowReassignModal(false);
        loadCancellationRequests();
      }
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || 'No se pudo reasignar'));
    } finally {
      setIsProcessing(false);
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
      admin: 'bg-purple-100 text-purple-800',
      super_admin: 'bg-red-100 text-red-800',
      admin_general: 'bg-indigo-100 text-indigo-800',
      admin_especialidad: 'bg-pink-100 text-pink-800'
    };
    
    const labels = {
      patient: 'Paciente',
      doctor: 'Doctor',
      admin: 'Admin',
      super_admin: 'Super Admin',
      admin_general: 'Admin General',
      admin_especialidad: 'Admin Esp.'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[role] || 'bg-gray-100 text-gray-800'}`}>
        {labels[role] || role}
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

  // Crear doctor
  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const doctorData = Object.fromEntries(formData);
    
    try {
      await api.post('/admin/doctors', doctorData);
      alert('✅ Doctor creado');
      e.target.reset();
      setShowDoctorForm(false);
      fetchData();
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.message);
    }
  };

  // ✅ FILTRAR USUARIOS SEGÚN ROL
  const filteredUsers = useMemo(() => {
    let result = filterRole === 'all' 
      ? users 
      : users.filter(u => u.role === filterRole);

    // Si es admin de especialidad, solo ver doctores de su especialidad
    if (isAdminEspecialidad && userSpecialtyId) {
      result = result.filter(u => {
        if (u.role === 'doctor') {
          return u.specialty_id === userSpecialtyId;
        }
        return true; // Deja ver pacientes y otros roles
      });
    }
    return result;
  }, [users, filterRole, isAdminEspecialidad, userSpecialtyId]);

  // ✅ FILTRAR CITAS SEGÚN ROL
  const filteredAppointments = useMemo(() => {
    let result = filterDate 
      ? appointments.filter(a => a.start_time.startsWith(filterDate))
      : appointments;

    // Si es admin de especialidad, solo ver citas de doctores de su especialidad
    if (isAdminEspecialidad && userSpecialtyId) {
      result = result.filter(a => a.doctor_specialty_id === userSpecialtyId);
    }
    return result;
  }, [appointments, filterDate, isAdminEspecialidad, userSpecialtyId]);

  // ✅ GENERAR TABS DINÁMICOS SEGÚN ROL
  const getTabs = () => {
    const tabs = [
      { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
      { id: 'users', label: '👥 Usuarios', icon: '👥' },
      { id: 'appointments', label: '📅 Citas', icon: '📅' },
      { id: 'reports', label: '📈 Reportes', icon: '📈' },
      { id: 'cancellations', label: '🚫 Cancelaciones', icon: '🚫' }, // ✅ NUEVA
    ];
    
    // Solo super_admin ve Config
    if (isAdminSuper) {
      tabs.push({ id: 'settings', label: '⚙️ Config', icon: '⚙️' });
      // Solo super_admin ve Reportes de Cancelaciones
      tabs.push({ id: 'cancellation_reports', label: '📋 Reporte Cancelaciones', icon: '📋' });
    }
    
    //  ven Pendientes
    if (isAdminSuper || isAdminGeneral || isAdminGeneral) { 
      tabs.push({ id: 'pending', label: '⏳ Pendientes', icon: '⏳' });
    }
    
    return tabs;
  };

  // OBTENER LABEL DEL ROL ACTUAL
  const getRoleLabel = () => {
    const labels = {
      super_admin: 'Super Admin',
      admin_general: 'Admin General',
      admin_especialidad: 'Admin Especialidad',
      admin: 'Admin'
    };
    return labels[user?.role] || 'Admin';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Lado izquierdo: Título */}
            <div>
              <h1 className="text-2xl font-bold text-gray-800">⚙️ Panel de Administración</h1>
              <p className="text-gray-500 text-sm">
                {isAdminSuper && 'Acceso total al sistema'}
                {isAdminGeneral && 'Gestión general de usuarios y citas'}
                {isAdminEspecialidad && `Gestión de especialidad: ${user?.specialty_name || '...'}`}
              </p>
            </div>

            {/* Lado derecho: Info usuario + Avatar + Campanita */}
            <div className="flex items-center space-x-4">
              {/* Info del usuario (texto) */}
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-800">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-500">{getRoleLabel()}</p>
              </div>

              {/* Avatar */}
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                isAdminSuper ? 'bg-gradient-to-br from-red-500 to-red-600' :
                isAdminGeneral ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                isAdminEspecialidad ? 'bg-gradient-to-br from-pink-500 to-pink-600' :
                'bg-gradient-to-br from-purple-500 to-purple-600'
              }`}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>

              {/* 🔔 Campanita de notificaciones */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="relative p-2 text-gray-400 hover:text-gray-600 transition rounded-full hover:bg-gray-100"
                  title="Ver notificaciones"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 block h-5 w-5 transform -translate-y-1/4 translate-x-1/4 rounded-full ring-2 ring-white bg-red-500 text-xs text-white font-bold flex items-center justify-center animate-pulse">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>

                {/* Dropdown de Notificaciones */}
                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600">🔔</span>
                        <h4 className="font-bold text-gray-800 text-sm">Notificaciones</h4>
                      </div>
                      {notifications.length > 0 && (
                        <button onClick={() => setNotifications([])} className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline">
                          Marcar todo leído
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-sm">No hay notificaciones nuevas</p>
                        </div>
                      ) : (
                        notifications.map((notif, index) => (
                          <div key={index} className="p-4 border-b border-gray-100 hover:bg-blue-50 transition cursor-pointer group"
                            onClick={() => { setActiveTab('cancellations'); setShowNotifDropdown(false); }}>
                            <div className="flex items-start gap-3">
                              <div className="bg-red-100 p-2 rounded-full text-red-600 group-hover:bg-red-200 transition">
                                <span className="text-sm">🛑</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-800 font-semibold">Dr. {notif.doctor_name || 'Sin nombre'}</p>
                                <p className="text-xs text-gray-600 mt-0.5">Solicitó cancelar cita #{notif.appointment_id}</p>
                                {notif.reason && <p className="text-xs text-gray-500 mt-1 italic bg-gray-50 p-1.5 rounded">"{notif.reason}"</p>}
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notif.requested_at).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
                      <button onClick={() => { setActiveTab('cancellations'); setShowNotifDropdown(false); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Ver todas las solicitudes →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Tabs de navegación - DINÁMICOS */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {getTabs().map(tab => (
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
                      {filteredAppointments.slice(0, 5).map(app => (
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
                    {isAdminSuper && <option value="super_admin">Super Admin</option>}
                    {(isAdminSuper || isAdminGeneral) && <option value="admin_general">Admin General</option>}
                    {(isAdminSuper || isAdminGeneral) && <option value="admin_especialidad">Admin Especialidad</option>}
                  </select>
                  <button
                    onClick={fetchData}
                    className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Actualizar
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
                            {/* Solo super_admin puede eliminar admins */}
                            {(!['admin', 'super_admin', 'admin_general', 'admin_especialidad'].includes(u.role) || isAdminSuper) && (
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
                    className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Actualizar
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

            {/* ⚙️ CONFIGURACIÓN - SOLO SUPER ADMIN */}
            {activeTab === 'settings' && isAdminSuper && (
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

                    <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      💾 Guardar Cambios
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ⏳ PENDIENTES - SOLO SUPER ADMIN Y ADMIN GENERAL */}
            {activeTab === 'pending' && (isAdminSuper || isAdminGeneral || isAdminEspecialidad) && (
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
            {/* 🚫 CANCELACIONES - PARA TODOS LOS ADMINS */}
            {activeTab === 'cancellations' && (isAdminSuper || isAdminGeneral || isAdminEspecialidad) && (
              <div className="space-y-6">
                {/* Header */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Gestión de Cancelaciones</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Revisa y aprueba/rechaza las solicitudes de cancelación de los doctores
                        <span className="ml-2 text-xs text-gray-400">
                          (Se actualiza automáticamente cada 30 segundos)
                        </span>
                      </p>
                    </div>
                    <button 
                      onClick={loadCancellationRequests}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
                    >
                      Actualizar Ahora
                    </button>
                  </div>
                </div>

                {/* Tabs: Pendientes / Historial */}
                <div className="bg-white border-b">
                  <nav className="flex space-x-8">
                    <button
                      onClick={() => setActiveCancelTab('pending')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                        activeCancelTab === 'pending'
                          ? 'border-red-600 text-red-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      ⏳ Pendientes ({cancellationRequests.filter(r => r.status === 'pending').length})
                    </button>
                    <button
                      onClick={() => setActiveCancelTab('history')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                        activeCancelTab === 'history'
                          ? 'border-green-600 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      📋 Historial ({cancellationRequests.filter(r => r.status !== 'pending').length})
                    </button>
                  </nav>
                </div>

                {/* Contenido de Pendientes */}
                {activeCancelTab === 'pending' && (
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {cancellationRequests.filter(r => r.status === 'pending').length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        ✅ No hay solicitudes pendientes
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doctor</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Paciente</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha Cita</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Motivo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Solicitado</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {cancellationRequests.filter(r => r.status === 'pending').map(req => (
                            <tr key={req.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{req.doctor_first_name} {req.doctor_last_name}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{req.patient_first_name} {req.patient_last_name}</p>
                                <p className="text-xs text-gray-500">Cita #{req.appointment_id}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(req.start_time || Date.now()).toLocaleString('es-ES')}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  req.cancellation_type === 'full_day' 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {req.cancellation_type === 'full_day' ? '🔴 Día completo' : ' Cita única'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={req.reason}>
                                {req.reason}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {new Date(req.requested_at).toLocaleString('es-ES')}
                              </td>
                              <td className="px-4 py-3 text-right space-x-1">
                                <button
                                  onClick={() => openApproveModal(req)}
                                  className="text-green-600 hover:text-green-800 text-xs font-medium px-2 py-1 bg-green-50 rounded border border-green-200"
                                  title="Aprobar y cancelar"
                                >
                                  ✅ Aprobar
                                </button>
                                <button
                                  onClick={() => openReassignModal(req)}
                                  className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 bg-blue-50 rounded border border-blue-200"
                                  title="Cambiar doctor o fecha"
                                >
                                  🔄 Reasignar
                                </button>
                                <button
                                  onClick={() =>  openRejectModal(req)}
                                  className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 bg-red-50 rounded border border-red-200"
                                  title="Rechazar solicitud"
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

                {/* Contenido de Historial */}
                {activeCancelTab === 'history' && (
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {cancellationRequests.filter(r => r.status !== 'pending').length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        📋 No hay historial de cancelaciones
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doctor</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Paciente</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Motivo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Revisado por</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notas Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {cancellationRequests.filter(r => r.status !== 'pending').map(req => (
                            <tr key={req.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{req.doctor_first_name} {req.doctor_last_name}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{req.patient_first_name} {req.patient_last_name}</p>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  req.cancellation_type === 'full_day' 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {req.cancellation_type === 'full_day' ? 'Día completo' : 'Cita única'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={req.reason}>
                                {req.reason}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  req.status === 'approved' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {req.status === 'approved' ? '✅ Aprobada' : '❌ Rechazada'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString('es-ES') : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 italic">
                                {req.admin_notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* 📋 REPORTE DE CANCELACIONES - SOLO SUPER ADMIN */}
            {activeTab === 'cancellation_reports' && isAdminSuper && (
              <div className="space-y-6">
                {/* Header */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">📋 Reporte de Cancelaciones Aprobadas</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Historial de cancelaciones aprobadas por administradores
                      </p>
                    </div>
                    <button
                      onClick={loadCancellationReports}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
                    >
                      Actualizar
                    </button>
                  </div>
                </div>

                {/* Tabla de Reportes */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {reportsLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Cargando reporte...</p>
                    </div>
                  ) : cancellationReports.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      📭 No hay cancelaciones aprobadas registradas
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doctor</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Paciente</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha Cita</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Motivo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Aprobado Por</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rol Admin</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notas Admin</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha Aprobación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cancellationReports.map((report) => (
                          <tr key={report.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">
                                {report.doctor_first_name} {report.doctor_last_name}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              Cita #{report.appointment_id}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {report.appointment_date 
                                ? new Date(report.appointment_date).toLocaleString('es-ES')
                                : 'N/A'
                              }
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={report.cancellation_reason}>
                              {report.cancellation_reason || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800 text-sm">
                                {report.admin_first_name} {report.admin_last_name}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                report.admin_role === 'super_admin' ? 'bg-red-100 text-red-800' :
                                report.admin_role === 'admin_general' ? 'bg-indigo-100 text-indigo-800' :
                                'bg-pink-100 text-pink-800'
                              }`}>
                                {report.admin_role === 'super_admin' ? 'Super Admin' :
                                report.admin_role === 'admin_general' ? 'Admin General' :
                                'Admin Esp.'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 italic max-w-xs truncate" title={report.admin_notes}>
                              {report.admin_notes || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(report.created_at).toLocaleString('es-ES')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal para crear doctor -  */}
        {showDoctorForm && (isAdminSuper || isAdminGeneral || isAdminEspecialidad) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <form onSubmit={handleCreateDoctor} className="bg-white p-6 rounded-xl shadow-lg w-96 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Crear Nuevo Doctor</h3>
              <input name="firstName" placeholder="Nombre" required className="w-full mb-2 p-2 border rounded" />
              <input name="lastName" placeholder="Apellido" required className="w-full mb-2 p-2 border rounded" />
              <input name="email" type="email" placeholder="Email" required className="w-full mb-2 p-2 border rounded" />
              <input name="password" type="password" placeholder="Contraseña temporal" required className="w-full mb-2 p-2 border rounded" />
              
              {/* Selector de especialidad */}
              <select name="specialty" required className="w-full mb-2 p-2 border rounded">
                <option value="">Seleccionar especialidad</option>
                {specialties.map(spec => (
                  <option key={spec.id} value={spec.name}>{spec.name}</option>
                ))}
              </select>
              
              <input name="license_number" placeholder="N° Licencia" required className="w-full mb-4 p-2 border rounded" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowDoctorForm(false)} className="px-4 py-2 bg-gray-600 rounded text-white">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Crear</button>
              </div>
            </form>
          </div>
        )}
      </div>
      {/* 🟢 MODAL DE APROBACIÓN CON NOTAS */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h3 className="text-white font-bold text-lg">✅ Aprobar Cancelación</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Estás aprobando la cancelación de la cita <strong>#{selectedRequest.appointment_id}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas para el historial (Opcional)</label>
                <textarea
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  rows="3"
                  placeholder="Escribir notas..."
                />
              </div>
            </div>
            <div className="bg-gray-50 p-4 flex justify-end gap-2">
              <button onClick={() => setShowApproveModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Cancelar</button>
              <button 
                onClick={confirmApprove} 
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Confirmar Aprobación'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🔄 MODAL DE REASIGNACIÓN */}
      {showReassignModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h3 className="text-white font-bold text-lg">🔄 Reasignar Cita</h3>
              <p className="text-blue-100 text-xs">Mover la cita a otro doctor o fecha</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Selector de Doctor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Doctor *</label>
                <select
                  value={reassignData.new_doctor_id}
                  onChange={(e) => setReassignData({...reassignData, new_doctor_id: e.target.value})}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Seleccionar doctor...</option>
                  {availableDoctors.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.first_name} {doc.last_name} 
                      {/* Si tienes la especialidad en el objeto user, muéstrala aquí */}
                    </option>
                  ))}
                </select>
              </div>
    
              {/* Selector de Fecha/Hora */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Fecha y Hora *</label>
                <input
                  type="datetime-local"
                  value={reassignData.new_start_time}
                  onChange={(e) => setReassignData({...reassignData, new_start_time: e.target.value})}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">El sistema verificará si el doctor está libre.</p>
              </div>
    
              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                <textarea
                  value={reassignData.note}
                  onChange={(e) => setReassignData({...reassignData, note: e.target.value})}
                  className="w-full border rounded-lg p-2 text-sm outline-none"
                  rows="2"
                  placeholder="Motivo del cambio..."
                />
              </div>
            </div>
            <div className="bg-gray-50 p-4 flex justify-end gap-2">
              <button onClick={() => setShowReassignModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Cancelar</button>
              <button 
                onClick={confirmReassign} 
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? 'Reasignando...' : 'Confirmar Reasignación'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🔴 MODAL DE RECHAZO */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h3 className="text-white font-bold text-lg">❌ Rechazar Cancelación</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Estás rechazando la solicitud de cancelación de la cita <strong>#{selectedRequest.appointment_id}</strong>.
                <br /><br />
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo del rechazo (Opcional)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  rows="3"
                  placeholder="Ej: El doctor debe atender esta cita, no hay disponibilidad para reprogramar..."
                />
              </div>
            </div>
            <div className="bg-gray-50 p-4 flex justify-end gap-2">
              <button 
                onClick={() => setShowRejectModal(false)} 
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmReject} 
                disabled={isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );

};

export default AdminDash;