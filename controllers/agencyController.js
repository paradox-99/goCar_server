const pool = require('../config/db');

const getAllAgency = async (req, res) => {
     const query = `
          Select agencies.*, address_info.* 
          from agencies
          join address_info
          on agencies.address_id = address_info.address_id
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
          SELECT agencies.*, address_info.*, users.name, users.email
          FROM ((agencies
          JOIN address_info ON agencies.address_id = address_info.address_id)
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
          SELECT agencies.*, address_info.*
          FROM ((agencies
          JOIN address_info ON agencies.address_id = address_info.address_id)
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
          SELECT booking_info.*, vehicles.brand, vehicles.model, users.name, users.email, agencies.agency_Name
          FROM (((booking_info
          JOIN users ON booking_info.user_id = users._id)
          JOIN vehicles ON booking_info.vehicle_id = vehicles.vehicle_id)
          JOIN agencies ON vehicles.agency_id = agencies.agency_id)
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}


module.exports = { getAllAgency, getAgencyDetails, getAgencyOwner, getAllBookings, getAgencyDetails2 }