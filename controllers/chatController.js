const pool = require('../config/db');
const { generateTransactionId } = require('./createIDs');

const ensureTable = async () => {
     await pool.query(`
          CREATE TABLE IF NOT EXISTS chat_messages (
               message_id varchar(40) PRIMARY KEY,
               booking_id varchar(20) NOT NULL,
               sender_id varchar(20) NOT NULL,
               receiver_id varchar(20) NOT NULL,
               message text NOT NULL,
               created_at timestamptz DEFAULT now()
          )
     `);
};

const listMessages = async (req, res) => {
     const { bookingId } = req.params;
     try {
          await ensureTable();
          const result = await pool.query(
               `SELECT * FROM chat_messages WHERE booking_id = $1 ORDER BY created_at ASC`,
               [bookingId]
          );
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const sendMessage = async (req, res) => {
     const { booking_id, sender_id, receiver_id, message } = req.body;
     try {
          await ensureTable();
          const id = `MSG-${generateTransactionId()}`;
          await pool.query(
               `INSERT INTO chat_messages (message_id, booking_id, sender_id, receiver_id, message)
                VALUES ($1, $2, $3, $4, $5)`,
               [id, booking_id, sender_id, receiver_id, message]
          );
          res.status(201).json({ message_id: id, message: 'Message sent' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = { listMessages, sendMessage };
