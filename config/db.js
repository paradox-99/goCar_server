// const mysql = require('mysql2')
const { Pool } = require('pg')
require('dotenv').config()

const dbPassword = process.env.DB_PASSWORD;


const pool = new Pool({
     user: process.env.DB_USER,
     host: process.env.DB_HOST,
     database: process.env.DB_NAME ,
     password: typeof dbPassword === 'string' ? dbPassword : '',
     port: Number(process.env.DB_PORT || 5432),
     ssl: { rejectUnauthorized: false }
})

module.exports = pool;