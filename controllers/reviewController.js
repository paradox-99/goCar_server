const pool = require('../config/db');

const addVehicleReview = async (req, res) => {
     const { vehicle_type, vehicle_id, user_id, rating, review } = req.body;
     const table = vehicle_type === 'bike' ? 'motorbike_reviews' : 'cars_reviews';
     const idColumn = vehicle_type === 'bike' ? 'bike_id' : 'car_id';
     try {
          await pool.query(
               `INSERT INTO ${table} (user_id, ${idColumn}, date, review, rating)
                VALUES ($1, $2, now(), $3, $4)`,
               [user_id, vehicle_id, review || null, rating]
          );
          res.status(201).json({ message: 'Review added' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const addDriverReview = async (req, res) => {
     const { driver_id, user_id, rating, review } = req.body;
     try {
          await pool.query(
               `INSERT INTO driver_reviews (driver_id, user_id, date, review, rating)
                VALUES ($1, $2, now(), $3, $4)`,
               [driver_id, user_id, review || null, rating]
          );
          res.status(201).json({ message: 'Driver review added' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const addAgencyReview = async (req, res) => {
     const { agency_id, user_id, rating, review } = req.body;
     try {
          await pool.query(
               `INSERT INTO agency_reviews (agency_id, user_id, date, review, rating)
                VALUES ($1, $2, now(), $3, $4)`,
               [agency_id, user_id, review || null, rating]
          );
          res.status(201).json({ message: 'Agency review added' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = { addVehicleReview, addDriverReview, addAgencyReview };
