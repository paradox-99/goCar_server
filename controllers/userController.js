const connectDB = require('../config/db')

// const showAllUsers = async(req, res) => {
//      const id = 2
//      const query = `SELECT *                          
//       FROM users                    
//        WHERE  id = ${id}` 

//      connectDB.query(query, (err, results) => {
//           if(err){
//                console.log('fetching error: ', err);
//                return res.status(500).json({ error: 'Failed to retrieve users' });
//           }
//           console.log(results);       
//           res.status(200).json(results);
//      })
// }

const showCarByBrand = async (req, res) => {
     const brand = "Toyota"
     const query = `
                        SELECT * From vehicles  
                        where brand= ${brand}
                      `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          console.log(results);
          res.status(200).json(results);
     })
}


const showCarByCarType = async (req, res) => {
     const car_type = "van"
     const query = `
            SELECT * From vehicles  
            where car_type= ${car_type}
          `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          console.log(results);
          res.status(200).json(results);
     })
}

module.exports = { showAllUsers }