const pool = require('../config/db')

const showBikeByBrand = async (req, res) => {
     const brand = req.params.brand
     const query = `
          SELECT *
          FROM ((address
          JOIN agencies ON address.address_id = agencies.address_id)
          JOIN bikes ON agencies.agency_id = bikes.agency_id)
          WHERE bikes.brand = $1
     `
     try {
          const result = await pool.query(query, [brand]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const bikeDetails = async (req, res) => {
     const id = req.params.id;

     let query = `
          SELECT bikes.*, agencies.agency_id, agencies.agency_name, agencies.owner_id, agencies.email
          FROM bikes
          JOIN agencies ON bikes.agency_id = agencies.agency_id
          WHERE bikes.bike_id = $1
     `

     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows[0]);
     } catch (error) {
          console.log(error.message);
          res.status(500).send(error.message);
     }
}

const getBikeReviews = async (req, res) => {
     const bikeId = req.params.id;
     const query = `
          SELECT reviews.*, users.name, users.photo
          FROM (motorbike_reviews AS reviews
          JOIN users ON reviews.user_id = users.user_id)
          WHERE reviews.bike_id = $1
     `

     try {
          const result = await pool.query(query, [bikeId]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showAllBikes = async (req, res) => {
     let query = `
     SELECT * 
     FROM bikes
     JOIN agencies ON bikes.agency_id = agencies.agency_id
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

module.exports = { showBikeByBrand, bikeDetails, showAllBikes, getBikeReviews }