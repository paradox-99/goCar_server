const pool = require('../config/db')
const { createDriverId } = require('./createIDs')

const showAllDrivers = async (req, res) => {
     const district = req.params.district

     try {
          const query = `
               SELECT drivers.*, address_info.*
               FROM drivers
               JOIN address_info
               ON drivers.address_id = address_info.address_id
               where address_info.district = $1
               `
          try {
               const result = await pool.query(query, [district]);
               res.json(result.rows);
          } catch (err) {
               res.status(500).send(err.message);
          }
     }
     catch (err) {
          res.status(500).send('Server Error');
     }
}

const checkNID = async (req, res) => {
     const nid = req.params.nid;

     const query = `
          SELECT *
          FROM drivers
          WHERE nid = $1
     `
     try {
          const result = await pool.query(query, [nid]);
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'NID not found', code: 0 });
          }
          else {
               return res.status(200).json({ message: 'NID found', code: 1 });
          }
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const checkPhone = async (req, res) => {
     const phone = req.params.phone;

     const query = `
          SELECT *
          FROM drivers
          WHERE phone = $1
     `
     try {
          const result = await pool.query(query, [phone]);
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'Phone not found', code: 0 });
          }
          else {
               return res.status(200).json({ message: 'Phone found', code: 1 });
          }
     } catch (err) {
          res.status(500).send(err.message);
     }
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
          VALUES ($1, $2, $3, $4, $5)
     `;

     try {
          const result = await pool.query(addressQuery, [addressId, address.district, address.upazilla, address.area, area]);
          if (result.rowCount === 1) {
               const userQuery = `
               INSERT INTO driver (_id, address_id, name, email, phone, gender, nid, dob, image, availability, verified, accountStatus, license_number, license_status, expire_date, experience)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               `;

               try {
                    const userResult = await pool.query(userQuery, [driverId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, userRole, verified, accountStatus, license_number, license_status, expire_date, experience]);
                    if (userResult.rowCount === 1) {
                         return res.status(201).json({ message: 'User account created successfully', code: 1 });
                    } else {
                         return res.status(500).json({ error: 'Failed to create user account.', code: 0 });
                    }
               } catch (error) {
                    res.status(500).send(error.message);
               }
          }
          else {
               return res.status(200).json({ message: 'Failed To Create user account.', code: 0 });
          }
     } catch (error) {
          res.status(500).send(error.message);
     }
}

module.exports = { showAllDrivers, checkNID, checkPhone, createDriver };