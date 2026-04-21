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

const getUserReviews = async (req, res) => {
     const { userId } = req.params;
     try {
          const carReviews = await pool.query(
               `SELECT cr.*, c.brand, c.model FROM cars_reviews cr JOIN cars c ON cr.car_id = c.car_id WHERE cr.user_id = $1`,
               [userId]
          );
          const motorbikeReviews = await pool.query(
               `SELECT mr.*, b.brand, b.model FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id = b.bike_id WHERE mr.user_id = $1`,
               [userId]
          );
          const driverReviews = await pool.query(
               `SELECT dr.*, d.name FROM driver_reviews dr JOIN driver_info d ON dr.driver_id = d.driver_id WHERE dr.user_id = $1`,
               [userId]
          );
          const agencyReviews = await pool.query(
               `SELECT ar.*, a.agency_name FROM agency_reviews ar JOIN agencies a ON ar.agency_id = a.agency_id WHERE ar.user_id = $1`,
               [userId]
          );

          res.json({
               carReviews: carReviews.rows,
               motorbikeReviews: motorbikeReviews.rows,
               driverReviews: driverReviews.rows,
               agencyReviews: agencyReviews.rows
          });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const getReceivedReviews = async (req, res) => {
     const { targetType, targetId } = req.params;
     let table = '';
     let idCol = '';
     if (targetType === 'car') { table = 'cars_reviews'; idCol = 'car_id'; }
     else if (targetType === 'bike') { table = 'motorbike_reviews'; idCol = 'bike_id'; }
     else if (targetType === 'driver') { table = 'driver_reviews'; idCol = 'driver_id'; }
     else if (targetType === 'agency') { table = 'agency_reviews'; idCol = 'agency_id'; }

     try {
          const result = await pool.query(
               `SELECT r.*, u.name, u.photo FROM ${table} r JOIN users u ON r.user_id = u.user_id WHERE r.${idCol} = $1`,
               [targetId]
          );
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = { addVehicleReview, addDriverReview, addAgencyReview, getUserReviews, getReceivedReviews };
