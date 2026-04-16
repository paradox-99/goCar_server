const pool = require('../config/db');
const { generateTransactionId } = require('./createIDs');

const listNotifications = async (req, res) => {
     const { userId } = req.params;
     try {
          const result = await pool.query(
               `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
               [userId]
          );
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const createNotification = async (req, res) => {
     const { user_id, message } = req.body;
     const notifId = `NOTIF-${generateTransactionId()}`;
     try {
          await pool.query(
               `INSERT INTO notifications (notif_id, user_id, message, created_at, is_read)
                VALUES ($1, $2, $3, now(), false)`,
               [notifId, user_id, message]
          );
          res.status(201).json({ notif_id: notifId, message: 'Notification created' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const markAsRead = async (req, res) => {
     const { notifId } = req.params;
     try {
          await pool.query(`UPDATE notifications SET is_read = true WHERE notif_id = $1`, [notifId]);
          res.json({ message: 'Notification marked as read' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = { listNotifications, createNotification, markAsRead };
