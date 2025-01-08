const connectDB = require('../config/db')

const showAllUsers = async (req, res) => {
     const query = `SELECT *
                    FROM users`

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
     console.log(email);
     
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

module.exports = { showAllUsers, getUserRole }