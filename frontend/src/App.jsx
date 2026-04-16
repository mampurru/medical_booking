import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Importar páginas
import Login from './pages/Login';
import PatientDash from './pages/PatientDash';
import DoctorDash from './pages/DoctorDash';  // Lo crearemos después
import AdminDash from './pages/AdminDash';    // Lo crearemos después
import Register from './pages/Register';

// Componente de navegación (lo crearemos en el Paso 2)
import Navbar from './components/Navbar';

// Componente para rutas protegidas
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
};

// Componente para redirigir si ya está logueado
const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    switch (user.role) {
      case 'admin': return <Navigate to="/admin" replace />;
      case 'doctor': return <Navigate to="/doctor" replace />;
      case 'patient': return <Navigate to="/patient" replace />;
      default: return <Navigate to="/" replace />;
    }
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Ruta pública - Login */}
            <Route path="/login" element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            } />

            {/* Rutas protegidas - Paciente */}
            <Route path="/patient" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDash />
              </ProtectedRoute>
            } />

            {/* Rutas protegidas - Doctor (placeholder por ahora) */}
            <Route path="/doctor" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDash />
              </ProtectedRoute>
            } />

            {/* Rutas protegidas - Admin (placeholder por ahora) */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDash />
              </ProtectedRoute>
            } />

            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 404 */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
                  <p className="text-gray-600">Página no encontrada</p>
                </div>
              </div>
            } />
            <Route path="/register" element={<Register />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;