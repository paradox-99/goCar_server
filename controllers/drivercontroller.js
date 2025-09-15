const connectDB = require('../config/db')
const { createDriverId } = require('./createIDs')

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

const checkNID = async(req, res) => {
     const nid = req.params.nid;
     
     const query = `
          SELECT *
          FROM drivers
          WHERE nid = ?
     `
     connectDB.query(query, [nid], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve user by NID' });
          }
          else if (results.length === 0) {
               console.log("code 0");
               
               return res.status(200).json({ message: 'NID not found', code: 0 });
          }
          else{
               console.log("code 1");
               
               return res.status(200).json({ message: 'NID found', code: 1 });
          }
     })
}

const checkPhone = async(req, res) => {
     const phone = req.params.phone;
     
     const query = `
          SELECT *
          FROM drivers
          WHERE phone = ?
     `
     connectDB.query(query, [phone], (err, results) => {
          console.log(results);
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve user by NID' });
          }
          else if (results.length === 0) {
               return res.status(200).json({ message: 'Phone not found', code: 0 });
          }
          else{
               return res.status(200).json({ message: 'Phone found', code: 1 });
          }
     })
}

const createDriver = async (req, res) => {
     const { address, area, name, email, phone, gender, nid, birthdate, profilePicture } = req.body;

     const driverId = createDriverId();
     const addressId = createAddressId();

     const userRole = "user"
     const verified = false
     const accountStatus = "Active"
     const license_number = null
     const license_status = "pending"
     const expire_date = null
     const experience = null
     
     const addressQuery = `
          INSERT INTO address_info (address_id, district, upazilla, keyArea, area)
          VALUES (?, ?, ?, ?, ?)
     `;

     connectDB.query(addressQuery, [addressId, address.district, address.upazilla, address.area, area], (err, addressResult) => {
          if (err) {
               console.log('Address insertion error: ', err);
               return res.status(500).json({ error: 'Failed to create address' });
          }

          const userQuery = `
               INSERT INTO driver (_id, address_id, name, email, phone, gender, nid, dob, image, availability, verified, accountStatus, license_number, license_status, expire_date, experience)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          connectDB.query(userQuery, [driverId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, userRole, verified, accountStatus, license_number, license_status, expire_date, experience], (err, userResult) => {
               if (err) {
                    console.log('User insertion error: ', err);
                    return res.status(500).json({ error: 'Failed to create user' });
               }
               res.status(201).json(userResult);
          });
     });
}

module.exports = { showAllDrivers, checkNID, checkPhone, createDriver };