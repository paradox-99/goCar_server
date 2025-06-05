const connectDB = require('../config/db')

const showAllDrivers = async (req, res) => {
     const district = req.params.district
     
     try {
          const query = `
               SELECT drivers.*, address_info.*
               FROM drivers
               JOIN address_info
               ON drivers.address_id = address_info.address_id
               where address_info.district = '${district}'
               `
          connectDB.query(query
               , (err, results) => {
                    if (err) {
                         console.error(err.message);
                         return res.status(500).json({ error: 'Failed to retrieve drivers' });
                    }
                    res.status(200).json(results);
               }
          )
     }
     catch (err) {
          console.error(err.message);
          res.status(500).send('Server Error');
     }
}
module.exports = { showAllDrivers };