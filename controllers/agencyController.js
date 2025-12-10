const pool = require('../config/db');

const getAllAgency = async (req, res) => {
     const query = `
          Select agencies.*, address.* 
          from agencies
          join address
          on agencies.address_id = address.address_id
     `
     try {
          const results = await pool.query(query);
          res.json(results.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

// agency details by user query
const getAgencyDetails = async (req, res) => {
     const agencyId = req.params.id;
     const query = `
          SELECT agencies.*, address.*, users.name, users.email
          FROM ((agencies
          JOIN address ON agencies.address_id = address.address_id)
          JOIN users ON agencies.owner_id = users._id)
          WHERE agencies.agency_id = $1
     `

     try {
          const result = await pool.query(query, [agencyId]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

// agency details by owner query
const getAgencyDetails2 = async (req, res) => {
     const ownerId = req.params.id
     const query = `
          SELECT agencies.*, address.*
          FROM ((agencies
          JOIN address ON agencies.address_id = address.address_id)
          JOIN users ON agencies.owner_id = users._id)
          WHERE agencies.owner_id = $1
     `

     try {
          const result = await pool.query(query, [ownerId]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyOwner = async (req, res) => {
     const ownerId = req.params.id
     const query = `
          SELECT name
          FROM users
          WHERE _id = $1
     `
     try {
          const result = await pool.query(query, [ownerId]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAllBookings = async (req, res) => {
     const query = `
          SELECT booking_info.*, cars.brand, cars.model, users.name, users.email, agencies.agency_Name
          FROM (((booking_info
          JOIN users ON booking_info.user_id = users._id)
          JOIN cars ON booking_info.vehicle_id = cars.car_id)
          JOIN agencies ON cars.agency_id = agencies.agency_id)
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}


module.exports = { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings, getAgencyDetails2 }