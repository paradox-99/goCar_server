const connectDB = require('../config/db')

const showAllUsers = async(req, res) => {
     const id = 2
     const query = `SELECT *
      FROM users
       WHERE  id = ${id}`

     connectDB.query(query, (err, results) => {
          if(err){
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          console.log(results);
          res.status(200).json(results);
     })
}

module.exports = { showAllUsers }