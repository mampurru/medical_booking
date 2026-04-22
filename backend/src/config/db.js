

// module.exports = { pool, testConnection };
const mysql = require('mysql2/promise');

// Crear pool de conexiones
const pool = mysql.createPool({
  // 🔥 IMPORTANTE: Leer variables de entorno SIN comillas extras
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Base de datos conectada exitosamente');
    console.log('📡 Host:', process.env.DB_HOST);
    console.log('🗄️ Database:', process.env.DB_NAME);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error de conexión a la base de datos:', error.message);
    console.error('🔍 DB_HOST value:', process.env.DB_HOST);
    console.error('🔍 DB_USER value:', process.env.DB_USER);
    console.error('🔍 DB_NAME value:', process.env.DB_NAME);
    throw error;
  }
};

module.exports = { pool, testConnection };