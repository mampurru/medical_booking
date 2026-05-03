const { verifyToken } = require('../utils/jwt');

const verifyTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token no proporcionado' 
    });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token inválido o expirado' 
    });
  }

  req.user = decoded;
  next();
};

// Función para autorizar roles específicos
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Acceso denegado. Se requiere uno de estos roles: ${roles.join(', ')}` 
      });
    }
    
    next();
  };
};

module.exports = { verifyTokenMiddleware, authorize };