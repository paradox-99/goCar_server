const connectDB = require('../config/db')

const getAllAgency = async(req, res) => {
     const query = `Select * from agencies`

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

module.exports = { getAllAgency }