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

const submitBookingReview = async (req, res) => {
     const {
          booking_id, vehicle_type, vehicle_id, agency_id, driver_id, user_id,
          vehicle_rating, vehicle_review,
          agency_rating, agency_review,
          driver_rating, driver_review,
     } = req.body;

     if (!booking_id || !vehicle_id || !user_id || !vehicle_rating) {
          return res.status(400).json({ message: 'booking_id, vehicle_id, user_id, and vehicle_rating are required' });
     }
     if (agency_rating && !agency_id) {
          return res.status(400).json({ message: 'agency_id is required when rating the agency' });
     }
     if (driver_rating && !driver_id) {
          return res.status(400).json({ message: 'driver_id is required when rating the driver' });
     }

     const vehicleTable = vehicle_type === 'bike' ? 'motorbike_reviews' : 'cars_reviews';
     const vehicleIdCol = vehicle_type === 'bike' ? 'bike_id' : 'car_id';
     const entityTable = vehicle_type === 'bike' ? 'bikes' : 'cars';
     const entityIdCol = vehicle_type === 'bike' ? 'bike_id' : 'car_id';

     const client = await pool.connect();
     try {
          await client.query('BEGIN');

          // Check if already reviewed for this booking
          const existing = await client.query(
               `SELECT 1 FROM ${vehicleTable} WHERE booking_id = $1 AND user_id = $2 LIMIT 1`,
               [booking_id, user_id]
          );
          if (existing.rows.length > 0) {
               await client.query('ROLLBACK');
               return res.status(409).json({ message: 'You have already reviewed this booking' });
          }

          await client.query(
               `INSERT INTO ${vehicleTable} (user_id, ${vehicleIdCol}, booking_id, date, review, rating)
                VALUES ($1, $2, $3, now(), $4, $5)`,
               [user_id, vehicle_id, booking_id, vehicle_review || null, vehicle_rating]
          );

          if (agency_id && agency_rating) {
               await client.query(
                    `INSERT INTO agency_reviews (agency_id, user_id, booking_id, date, review, rating)
                     VALUES ($1, $2, $3, now(), $4, $5)`,
                    [agency_id, user_id, booking_id, agency_review || null, agency_rating]
               );
               await client.query(
                    `UPDATE agencies
                     SET rating = (SELECT COALESCE(AVG(rating), 0) FROM agency_reviews WHERE agency_id = $1),
                         rating_count = (SELECT COUNT(*) FROM agency_reviews WHERE agency_id = $1),
                         review_count = (SELECT COUNT(*) FROM agency_reviews WHERE agency_id = $1 AND review IS NOT NULL)
                     WHERE agency_id = $1`,
                    [agency_id]
               );
          }

          if (driver_id && driver_rating) {
               await client.query(
                    `INSERT INTO driver_reviews (driver_id, user_id, booking_id, date, review, rating)
                     VALUES ($1, $2, $3, now(), $4, $5)`,
                    [driver_id, user_id, booking_id, driver_review || null, driver_rating]
               );
               await client.query(
                    `UPDATE driver_info
                     SET rating = (SELECT COALESCE(AVG(rating), 0) FROM driver_reviews WHERE driver_id = $1),
                         rating_count = (SELECT COUNT(*) FROM driver_reviews WHERE driver_id = $1),
                         review_count = (SELECT COUNT(*) FROM driver_reviews WHERE driver_id = $1 AND review IS NOT NULL)
                     WHERE driver_id = $1`,
                    [driver_id]
               );
          }

          // Update vehicle aggregate rating
          await client.query(
               `UPDATE ${entityTable}
                SET rating = (SELECT COALESCE(AVG(rating), 0) FROM ${vehicleTable} WHERE ${vehicleIdCol} = $1),
                    rating_count = (SELECT COUNT(*) FROM ${vehicleTable} WHERE ${vehicleIdCol} = $1),
                    review_count = (SELECT COUNT(*) FROM ${vehicleTable} WHERE ${vehicleIdCol} = $1 AND review IS NOT NULL)
                WHERE ${entityIdCol} = $1`,
               [vehicle_id]
          );

          await client.query('COMMIT');
          res.status(201).json({ message: 'Reviews submitted successfully' });
     } catch (error) {
          await client.query('ROLLBACK');
          res.status(500).send(error.message);
     } finally {
          client.release();
     }
};

const checkBookingReview = async (req, res) => {
     const { bookingId } = req.params;
     const { userId } = req.query;
     try {
          const result = await pool.query(
               `SELECT 1 FROM cars_reviews WHERE booking_id = $1 AND user_id = $2
                UNION ALL
                SELECT 1 FROM motorbike_reviews WHERE booking_id = $1 AND user_id = $2
                LIMIT 1`,
               [bookingId, userId]
          );
          res.json({ reviewed: result.rows.length > 0 });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = { addVehicleReview, addDriverReview, addAgencyReview, getUserReviews, getReceivedReviews, submitBookingReview, checkBookingReview };
