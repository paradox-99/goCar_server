const connectDB = require('../config/db')

// const showCarByBrand = async(req, res) => {
//      const brand = 'Toyota';
//      // const query = `SELECT * FROM cars WHERE brand = '${brand}'`

//      connectDB.query(query, (err, results) => {
//           if(err){
//                console.log('fetching error: ', err);
//                return res.status(500).json({ error: 'Failed to retrieve users' });
//           }
//           res.status(200).json(results);
//      })
// }

const showCarByBrand = async (req, res) => {
     const brand = "Toyota"
     const query = `
          SELECT * 
          From vehicles
          where brand = '${brand}'
     `

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

// show car by brand
// show car by car type
// show car by address

module.exports = { showCarByBrand };