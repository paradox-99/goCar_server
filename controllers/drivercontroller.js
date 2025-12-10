const pool = require('../config/db')
const { createDriverId } = require('./createIDs')

const showAllDrivers = async (req, res) => {
     const district = req.params.district

     try {
          const query = `
               SELECT drivers.*, address.*
               FROM drivers
               JOIN address
               ON drivers.address_id = address.address_id
               where address.district = $1
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
          SELECT _id
          FROM users
          WHERE nid = $1
          UNION
          SELECT _id
          FROM drivers
          WHERE nid = $2 
     `
     try {
          const result = await pool.query(query, [nid, nid]);
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
          SELECT _id
          FROM users
          WHERE phone = $1
          UNION
          SELECT _id
          FROM drivers
          WHERE phone = $2
     `
     try {
          const result = await pool.query(query, [phone, phone]);
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

const checkLicense = async (req, res) => {
     const license_number = req.params.license_number;

     const query = `
          SELECT _id
          FROM drivers
          WHERE license_number = $1
     `
     try {
          const result = await pool.query(query, [license_number]);
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'License not found', code: 0 });
          }
          else {
               return res.status(200).json({ message: 'License found', code: 1 });
          }
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const createDriver = async (req, res) => {
     const { address, area, name, email, phone, gender, nid, birthdate, profilePicture, licenseNumber, licenseIssueDate, issuingAuthority, experience, hiringPrice } = req.body;

     const driverId = createDriverId();
     const addressId = createAddressId();

     const verified = false
     const accountStatus = "Active"
     const license_status = "pending"
     const availability = "Yes"

     const addressQuery = `
          INSERT INTO address (address_id, district, upazilla, keyArea, area)
          VALUES ($1, $2, $3, $4, $5)
     `;

     try {
          const result = await pool.query(addressQuery, [addressId, address.district, address.upazilla, address.area, area]);
          if (result.rowCount === 1) {
               const userQuery = `
               INSERT INTO driver (_id, address_id, name, email, phone, gender, nid, dob, image, availability, verified, accountStatus, license_number, license_status, issue_date, experience, hiring_price, license_authority)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
               `;

               try {
                    const userResult = await pool.query(userQuery, [driverId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, availability, verified, accountStatus, licenseNumber, license_status, licenseIssueDate, experience, hiringPrice, issuingAuthority]);
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

module.exports = { showAllDrivers, checkNID, checkPhone, checkLicense, createDriver };