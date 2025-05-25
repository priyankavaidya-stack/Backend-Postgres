const { Pool } = require("pg");

// PostgreSQL connection setup using Pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Test connection on startup
pool.connect()
    .then(()=>{
        console.log("Successfully connected to PostgreSQL!");
    })
    .catch((err)=>{
        console.error('Error connecting to PostgreSQL: ', err);
});

module.exports = pool;