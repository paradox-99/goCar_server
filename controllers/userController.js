const pool = require('../config/db');
const { createUserId, createAddressId } = require('./createIDs');

const showAllUsers = async (req, res) => {

     const query = "SELECT * FROM users JOIN address ON users.address_id = address.address_id";

     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const getUserRole = async (req, res) => {
     const email = req.params.email;

     const query = `
          SELECT _id, name, userRole
          FROM users
          WHERE email = $1`

     try {
          const result = await pool.query(query, [email]);
          res.json(result.rows);
     } catch (err) {
          res.status(500).send(err.message);
     }
}

const getUser = async (req, res) => {
     const email = req.params.email;

     if (req.user.email !== email) {
          return res.status(403).json({ error: 'Forbidden access' });
     }

     const query = `
          SELECT users.*, address.*
          FROM users
          JOIN address ON users.address_id = address.address_id
          WHERE users.email = $1
     `

     try {
          const result = await pool.query(query, [email]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getBookings = async (req, res) => {
     const id = req.params.id

     const query = `
          SELECT *
          FROM booking_info
          JOIN cars ON booking_info.vehicle_id = cars.car_id
          WHERE user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const checkNID = async (req, res) => {
     const nid = req.params.nid;

     console.log("hit");
     
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
     } catch (error) {
          res.status(500).send(error.message);
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
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const createUser = async (req, res) => {
     const { address, area, name, email, phone, gender, nid, birthdate, profilePicture } = req.body;

     const userId = createUserId();
     const addressId = createAddressId();

     const userRole = "user"
     const verified = false
     const accountStatus = "Active"
     const license_number = null
     const license_status = "pending"
     const expire_date = null
     const experience = null

     const addressQuery = `
          INSERT INTO address (address_id, district, upazilla, keyArea, area)
          VALUES ($1, $2, $3, $4, $5)
     `;

     try {
          const result = await pool.query(addressQuery, [addressId, address.district, address.upazilla, address.area, area]);

          if (result.rowCount === 1) {
               const userQuery = `
               INSERT INTO users (_id, address_id, name, email, phone, gender, nid, dob, image, userRole, verified, accountStatus, license_number, license_status, expire_date, experience)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               `;

               try {
                    const userResult = await pool.query(userQuery, [userId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, userRole, verified, accountStatus, license_number, license_status, expire_date, experience]);

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

module.exports = { showAllUsers, getUserRole, getUser, getBookings, createUser, checkNID, checkPhone };