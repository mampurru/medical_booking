import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api'; // Ajusta la ruta si es necesario

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'patient', // Valor por defecto
    phone: '',
    specialty: '',
    license_number: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
        const response = await api.post('/auth/register', formData);
        
        if (response.data.success) {
            if (formData.role === 'doctor') {
            alert('✅ Registro exitoso. Tu cuenta está pendiente de aprobación por un administrador. Recibirás un email cuando sea activada.');
            } else {
            alert('✅ Registro exitoso. ¡Bienvenido!');
            }
            navigate('/login');
        } else {
            setError(response.data.message || 'Error al registrarse');
        }
        } catch (error) {
        setError(error.response?.data?.message || 'Error en el servidor. Intenta de nuevo.');
        } finally {
        setLoading(false);
        }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo / Título */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Crear Cuenta</h1>
          <p className="text-gray-500 text-sm">Regístrate para comenzar</p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Formulario base - SOLO VISUAL POR AHORA */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="firstName"
              placeholder="Nombre *"
              onChange={handleChange}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              name="lastName"
              placeholder="Apellido *"
              onChange={handleChange}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <input
            type="email"
            name="email"
            placeholder="Correo electrónico *"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          
          <input
            type="password"
            name="password"
            placeholder="Contraseña *"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />

          <input
            name="phone"
            placeholder="Teléfono (opcional)"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />

          <select
            name="role"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="patient">Soy Paciente</option>
            <option value="doctor">Soy Doctor</option>
          </select>
          {formData.role === 'doctor' && (
            <input
              type="text"
              name="specialty"
              placeholder="Especialidad (opccional)"
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
        )}
        {formData.role === 'doctor' && (
            <input
            type="text"
            name="license_number"
            placeholder="Número de licencia *"
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
        )}
          {formData.role === 'doctor' && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm">
                ⚠️ El registro de doctores requiere aprobación manual de un administrador. 
                Recibirás un email cuando tu cuenta sea activada.
            </div>
            )}

          <button
            type="submit" // ✅ Cambiar de "button" a "submit"
            onClick={handleSubmit} // ✅ Agregar esto
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition"
            >
            {loading ? 'Creando cuenta...' : 'Registrarme'}
            </button>
        </form>

        {/* Volver al login */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
{/*// Si el usuario selecciona "Doctor", mostrar advertencia:
{formData.role === 'doctor' && (
  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm">
    ⚠️ El registro de doctores requiere aprobación manual de un administrador. 
    Recibirás un email cuando tu cuenta sea activada.
  </div>
)}

// En el handleSubmit:
const result = await api.post('/auth/register', {
  ...formData,
  // El backend decidirá el status según el rol
});

if (result.success) {
  if (formData.role === 'doctor') {
    alert('✅ Registro exitoso. Tu cuenta está pendiente de aprobación. Te notificaremos por email.');
  } else {
    alert('✅ Registro exitoso. ¡Bienvenido!');
    navigate('/login');
  }
}
*/}