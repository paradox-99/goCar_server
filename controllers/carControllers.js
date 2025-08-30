const connectDB = require('../config/db')

const showCarByBrand = async (req, res) => {
     const brand = req.params.brand
     const query = `
          SELECT *
          FROM ((address_info
          JOIN agencies ON address_info.address_id = agencies.address_id)
          JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
          WHERE '${brand}' = vehicles.brand
     `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const showCarByType = async (req, res) => {
     const car_type = req.params.type

     const query = `
          SELECT *
          FROM ((address_info
          JOIN agencies ON address_info.address_id = agencies.address_id)
          JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
          WHERE '${car_type}' = vehicles.car_type
     `

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const carsByQuery = async (req, res) => {
     const params = req.query;
     const query = `
          SELECT *
          FROM ((address_info
          JOIN agencies ON address_info.address_id = agencies.address_id)
          JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
          WHERE '${params.district}' = address_info.district && '${params.upazilla}' = address_info.upazilla && '${params.keyArea}' = address_info.keyArea
     `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const carsByFilter = async (req, res) => {
     const params = req.query;
     let query = ''
     if (params.district) {
          query = `
               SELECT vehicles.*
               FROM ((address_info
               JOIN agencies ON address_info.address_id = agencies.address_id)
               JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
               WHERE '${params.district}' = address_info.district
          `
     }
     else if (params.upazilla) {
          query = `
               SELECT *
               FROM ((address_info
               JOIN agencies ON address_info.address_id = agencies.address_id)
               JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
               WHERE '${params.upazilla}' = address_info.upazilla
          `
     }

     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const cartCars = async (req, res) => {
     const params = req.query;
     const ids = Object.values(params)

     let query = `
          SELECT *
          FROM vehicles
          WHERE vehicle_id IN (?)
     `
     console.log(query);

     connectDB.query(query, [ids], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          // console.log(results, );

          res.status(200).json(results);
     })
}

const showAllCars = async (req, res) => {
     let query = `
     SELECT *
     FROM vehicles
     JOIN agencies ON vehicles.agency_id = agencies.agency_id
     `
     connectDB.query(query, (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const showAgencyCars = async (req, res) => {
     const id = req.params.id;
     let query = ''

     if (id.includes('AG')) {
          query = `
          SELECT vehicles.*
          FROM (agencies 
          JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
          WHERE agencies.agency_id = ?
     `
     }
     else {
          query = `
          SELECT vehicles.*
          FROM (( users
          JOIN agencies ON users._id = agencies.owner_id)
          JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
          WHERE users._id = ?
     `
     }

     connectDB.query(query, [id], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

const agencyActiveBookingCars = async (req, res) => {
     const id = req.params.id;
     let query = `
          SELECT vehicles.brand, vehicles.model, booking_info.*
          FROM (((users
          JOIN agencies ON users._id = agencies.owner_id)
          JOIN vehicles ON agencies.agency_id = vehicles.agency_id)
          JOIN booking_info ON vehicles.vehicle_id = booking_info.vehicle_id)
          WHERE users._id = ?
     `
     connectDB.query(query, [id], (err, results) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.status(200).json(results);
     })
}

module.exports = { showCarByBrand, showCarByType, carsByQuery, carsByFilter, cartCars, showAllCars, showAgencyCars, agencyActiveBookingCars };