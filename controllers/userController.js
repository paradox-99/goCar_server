const connectDB = require('../config/db');
const { createUserId, createAddressId } = require('./createIDs');

const showAllUsers = async (req, res) => {
     const query = `SELECT *
                    FROM users
                    JOIN address_info ON users.address_id = address_info.address_id
                    `

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

     const query = `
          SELECT _id, name, userRole
          FROM users
          WHERE email = ?`

     // const query2 = `SELECT users.*, address_info.* FROM users JOIN address_info ON users.address_id = address_info.address_id WHERE users.email = '${email}'`

     connectDB.query(query, [email], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve user role' });
          }
          res.status(200).json(results);
     })
}

const getUser = async (req, res) => {
     const email = req.params.email;
     console.log(req.user.email);
     
     if(req.user.email !== email){
          return res.status(403).json({ error: 'Forbidden access' });
     }

     const query = `
          SELECT users.*, address_info.*
          FROM users
          JOIN address_info ON users.address_id = address_info.address_id
          WHERE users.email = '${email}'
     `
     connectDB.query(query, [email], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve user' });
          }
          res.status(200).json(results[0]);
     })
}

const getBookings = async (req, res) => {
     const id = req.params.id

     const query = `
          SELECT *
          FROM booking_info
          JOIN vehicles ON booking_info.vehicle_id = vehicles.vehicle_id
          WHERE user_id = ?
     `
     connectDB.query(query, [id], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve bookings' });
          }
          res.status(200).json(results);
     })
}

const checkNID = async(req, res) => {
     const nid = req.params.nid;
     
     const query = `
          SELECT *
          FROM users
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
          FROM users
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
          INSERT INTO address_info (address_id, district, upazilla, keyArea, area)
          VALUES (?, ?, ?, ?, ?)
     `;

     connectDB.query(addressQuery, [addressId, address.district, address.upazilla, address.area, area], (err, addressResult) => {
          if (err) {
               console.log('Address insertion error: ', err);
               return res.status(500).json({ error: 'Failed to create address' });
          }

          const userQuery = `
               INSERT INTO users (_id, address_id, name, email, phone, gender, nid, dob, image, userRole, verified, accountStatus, license_number, license_status, expire_date, experience)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          connectDB.query(userQuery, [userId, addressId, name, email, phone, gender, nid, birthdate, profilePicture, userRole, verified, accountStatus, license_number, license_status, expire_date, experience], (err, userResult) => {
               if (err) {
                    console.log('User insertion error: ', err);
                    return res.status(500).json({ error: 'Failed to create user' });
               }
               res.status(201).json(userResult);
          });
     });
}

module.exports = { showAllUsers, getUserRole, getUser, getBookings, createUser, checkNID, checkPhone }