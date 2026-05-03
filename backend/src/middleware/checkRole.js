/**
 * Middleware para verificar roles
 * @param {string[]} allowedRoles - Array de roles permitidos
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. No tienes permisos suficientes para realizar esta acción.'
      });
    }
    
    next();
  };
};

module.exports = checkRole;