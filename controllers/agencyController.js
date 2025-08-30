const connectDB = require('../config/db')

const getAllAgency = async (req, res) => {
     const query = `
          Select agencies.*, address_info.* 
          from agencies
          join address_info
          on agencies.address_id = address_info.address_id
     `

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const getAgencyDetails = async (req, res) => {
     const agencyId = req.params.id
     const query = `
          SELECT agencies.*, address_info.*, users.name, users.email
          FROM ((agencies
          JOIN address_info ON agencies.address_id = address_info.address_id)
          JOIN users ON agencies.owner_id = users._id)
          WHERE agencies.agency_id = ?
     `
     connectDB.query(query, [agencyId], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results[0]);
     })
}

const getAgencyDetails2 = async (req, res) => {
     const ownerId = req.params.id
     const query = `
          SELECT agencies.*, address_info.*
          FROM ((agencies
          JOIN address_info ON agencies.address_id = address_info.address_id)
          JOIN users ON agencies.owner_id = users._id)
          WHERE agencies.owner_id = ?
     `
     
     connectDB.query(query, [ownerId],(err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results[0]);
     })
}

const getAgencyOwner = async (req, res) => {
     const ownerId = req.params.id
     const query = `
          SELECT name
          FROM users
          WHERE _id = ?
     `
     connectDB.query(query,[ownerId], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results[0]);
     })
}

const getAllBookings = async (req, res) => {
     const query = `
          SELECT booking_info.*, vehicles.brand, vehicles.model, users.name, users.email, agencies.agency_Name
          FROM (((booking_info
          JOIN users ON booking_info.user_id = users._id)
          JOIN vehicles ON booking_info.vehicle_id = vehicles.vehicle_id)
          JOIN agencies ON vehicles.agency_id = agencies.agency_id)
     `
     console.log(query);

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve bookings' });
          }
          res.status(200).json(results);
     })
}


module.exports = { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings, getAgencyDetails2 }