const pool = require('../config/db')
const { generateBookingId } = require('./createIDs')

const createBooking = async (req, res) => {
     const { vehicle_type, driver_cost, start_ts, end_ts, total_cost, total_rent_hours, user_id, vehicle_id, booking_purpose, estimated_destination, driver_id } = req.body;

     console.log(driver_id);
     

     const booking_id = generateBookingId();
     const booking_request = 'Requested';

     const query = `
          INSERT INTO booking_info (booking_id, vehicle_type, vehicle_id, start_ts, end_ts, booking_ts, total_rent_hours, driver_cost, total_cost, driver_id, booking_request, user_id, booking_purpose, estimated_destination)
          VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10, $11, $12, $13)
     `;

     try {
          const result = await pool.query(query, [booking_id, vehicle_type, vehicle_id, start_ts, end_ts, total_rent_hours, driver_cost, total_cost, driver_id, booking_request, user_id, booking_purpose, estimated_destination]);
          if (result.rowCount === 0) {
               return res.status(200).json({ message: 'Failed To Create Booking.', code: 0 });
          }
          res.status(200).json({ message: 'Booking Created Successfully.', code: 1 });
     } catch (error) {
          console.log(error.message);
          
          res.status(500).send(error.message);
     }
}

const getUserBookings = async (req, res) => {
     const id = req.params.id;
     const query = `
          SELECT booking_info.*, cars.brand, cars.model, cars.license_plate
          FROM (booking_info
          JOIN cars ON booking_info.vehicle_id = cars.car_id)
          WHERE booking_info.user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getCarBookings = async (req, res) => {
     const id = req.params.id;
     const query = `
          SELECT booking_info.*, users.name, users.phone
          FROM (booking_info
          JOIN users ON booking_info.user_id = users._id)
          WHERE booking_info.vehicle_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

module.exports = { createBooking, getUserBookings, getCarBookings }