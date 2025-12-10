const pool = require('../config/db')

const showCarByBrand = async (req, res) => {
     const brand = req.params.brand
     const query = `
          SELECT *
          FROM ((address
          JOIN agencies ON address.address_id = agencies.address_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE $1 = cars.brand
     `
     try {
          const result = await pool.query(query, [brand]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showCarByType = async (req, res) => {
     const car_type = req.params.type

     const query = `
          SELECT *
          FROM ((address
          JOIN agencies ON address.address_id = agencies.address_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE $1 = cars.car_type
     `

     try {
          const result = await pool.query(query, [car_type]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const carsByQuery = async (req, res) => {
     const params = req.query;
     const query = `
          SELECT *
          FROM ((address
          JOIN agencies ON address.address_id = agencies.address_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE $1 = address.district && $2 = address.upazilla && $3 = address.keyArea
     `
     try {
          const result = await pool.query(query, [params.district, params.upazilla, params.keyArea]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message); 
     }
}

const carsByFilter = async (req, res) => {
     const params = req.query;
     let query = ''
     if (params.district) {
          query = `
               SELECT cars.*
               FROM ((address
               JOIN agencies ON address.address_id = agencies.address_id)
               JOIN cars ON agencies.agency_id = cars.agency_id)
               WHERE '${params.district}' = address.district
          `
     }
     else if (params.upazilla) {
          query = `
               SELECT *
               FROM ((address
               JOIN agencies ON address.address_id = agencies.address_id)
               JOIN cars ON agencies.agency_id = cars.agency_id)
               WHERE '${params.upazilla}' = address.upazilla
          `
     }

     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const cartCars = async (req, res) => {
     const params = req.query;
     const ids = Object.values(params)

     let query = `
          SELECT *
          FROM cars
          WHERE car_id IN ($1)
     `

     try {
          const result = await pool.query(query, [ids]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showAllCars = async (req, res) => {
     let query = `
     SELECT *
     FROM cars
     JOIN agencies ON cars.agency_id = agencies.agency_id
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showAgencyCars = async (req, res) => {
     const id = req.params.id;
     let query = ''

     if (id.includes('AG')) {
          query = `
          SELECT cars.*
          FROM (agencies 
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE agencies.agency_id = $1
     `
     }
     else {
          query = `
          SELECT cars.*
          FROM (( users
          JOIN agencies ON users._id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE users._id = $1
     `
     }

     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const agencyActiveBookingCars = async (req, res) => {
     const id = req.params.id;
     let query = `
          SELECT cars.brand, cars.model, booking_info.*
          FROM (((users
          JOIN agencies ON users._id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          JOIN booking_info ON cars.car_id = booking_info.vehicle_id)
          WHERE users._id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

module.exports = { showCarByBrand, showCarByType, carsByQuery, carsByFilter, cartCars, showAllCars, showAgencyCars, agencyActiveBookingCars };