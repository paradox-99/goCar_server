const connectDB = require('../config/db')

const showAllUsers = async (req, res) => {
     const query = `SELECT *
                    FROM users
                    JOIN address_info ON users.address_id = address_info.address_id
                    `

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const getUserRole = async (req, res) => {
     const email = req.params.email;

     const query = `
          SELECT _id, name, userRole
          FROM users
          WHERE email = ?`

     connectDB.query(query, email, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve user role' });
          }
          res.status(200).json(results);
     })
}

const getUser = async (req, res) => {
     const email = req.params.email;
     
     const query = `
          SELECT users.*, address_info.*
          FROM users
          JOIN address_info ON users.address_id = address_info.address_id
          WHERE users.email = '${email}'
     `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve user' });
          }
          res.status(200).json(results[0]);
     })
}

const getBookings = async(req, res) => {
     const id = req.params.id

     const query = `
          SELECT *
          FROM booking_info
          JOIN vehicles ON booking_info.vehicle_id = vehicles.vehicle_id
          WHERE user_id = '${id}'
     `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve bookings' });
          }
          res.status(200).json(results);
     })
}


module.exports = { showAllUsers, getUserRole, getUser, getBookings }