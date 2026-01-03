const pool = require('../config/db')
const { generateBookingId } = require('./createIDs')

const createBooking = async (req, res) => {
     const { vehicle_type, driver_cost, start_ts, end_ts, total_cost, total_rent_hours, user_id, vehicle_id, booking_purpose, estimated_destination, driver_id } = req.body;

     const booking_id = generateBookingId();
     const status = 'Requested';
     const client = await pool.connect();      

     const query = `
          INSERT INTO booking_info (booking_id, vehicle_type, vehicle_id, start_ts, end_ts, booking_ts, total_rent_hours, driver_cost, total_cost, driver_id, status, user_id, booking_purpose, estimated_destination)
          VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10, $11, $12, $13)
     `;

     const updateCarStatus = `
          UPDATE cars
          SET status = 'Unavailable'
          WHERE car_id = $1
     `;

     const updateBikeStatus = `
          UPDATE bikes
          SET status = 'Unavailable'
          WHERE bike_id = $1
     `;

     const updateDriverStatus = `
          UPDATE driver_info
          SET availability = false
          WHERE driver_id = $1
     `;

     try {
          await client.query('BEGIN');

          const result = await client.query(query, [booking_id, vehicle_type, vehicle_id, start_ts, end_ts, total_rent_hours, driver_cost, total_cost, driver_id, user_id, booking_purpose, status, estimated_destination]);
          if (result.rowCount === 0) {
               await client.query('ROLLBACK');
               return res.status(200).json({ message: 'Failed To Create Booking.', code: 0 });
          }

          // Update vehicle availability based on type
          if (vehicle_type === 'Car') {
               await client.query(updateCarStatus, [vehicle_id]);
          } else if (vehicle_type === 'Bike') {
               await client.query(updateBikeStatus, [vehicle_id]);
          }

          // Update driver availability if driver_id is provided
          if (driver_id) {
               await client.query(updateDriverStatus, [driver_id]);
          }

          await client.query('COMMIT');
          res.status(200).json({ message: 'Booking Created Successfully.', code: 1 });
     } catch (error) {
          await client.query('ROLLBACK');
          console.log(error.message);
          res.status(500).send(error.message);
     } finally {
          client.release();
     }
}

const getUserBookings = async (req, res) => {
     const id = req.params.id;
     
     const query = `
          SELECT booking_info.*, cars.brand, cars.model, cars.car_type, cars.images, cars.seats, cars.fuel, cars.mileage, cars.gear, cars.rental_price, cars.transmission_type, agencies.agency_name, agencies.address_id, agencies.phone_number as agency_phone, agencies.email as agency_email, driver_info.name as driver_name, driver_info.email as driver_email, driver_info.address_id as driver_address_id, driver_info.phone as driver_phone, driver_info.photo as driver_photo, driver_info.experience_year, driver_info.rating, driver_info.rental_price, agadd.display_name as agency_address, driadd.display_name as driver_address
          FROM booking_info
          JOIN cars ON booking_info.vehicle_id = cars.car_id
          JOIN agencies ON cars.agency_id = agencies.agency_id
          JOIN address as agadd ON agencies.address_id = agadd.address_id
          LEFT JOIN driver_info ON booking_info.driver_id = driver_info.driver_id
          LEFT JOIN address as driadd ON driver_info.address_id = driadd.address_id
          WHERE booking_info.user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          console.log(error.message);
          res.status(500).send(error.message);
     }
}

const cancelBooking = async (req, res) => {
     const id = req.params.id;
     const { cancelledBy, cancelReason } = req.body;
     console.log(id, cancelledBy, cancelReason);
     const client = await pool.connect();         

     

     const updateCancelReason = `
          UPDATE booking_info
          SET cancelled_by = $2, cancel_reason = $3, status = 'Cancelled', cancelled_at = now()
          WHERE booking_id = $1
     `;

     // Get vehicle type first
     const getVehicleType = `
          SELECT vehicle_type, vehicle_id
          FROM booking_info
          WHERE booking_id = $1
     `;

     const updateCarStatus = `
          UPDATE cars
          SET status = 'Available'
          WHERE car_id = $1
     `;

     const updateBikeStatus = `
          UPDATE bikes
          SET status = 'Available'
          WHERE bike_id = $1
     `;

     const updateDriverStatus = `
          UPDATE driver_info
          SET availability = true
          WHERE driver_id = (SELECT driver_id FROM booking_info WHERE booking_id = $1)
     `;

     try {
          await client.query('BEGIN');

          const result = await client.query(updateCancelReason, [id, cancelledBy, cancelReason]);
          if (result.rowCount === 0) {
               await client.query('ROLLBACK');
               return res.status(200).json({ message: 'Failed To Cancel Booking.' });
          }

          // Get vehicle type to determine which table to update
          const vehicleResult = await client.query(getVehicleType, [id]);
          if (vehicleResult.rowCount > 0) {
               const { vehicle_type, vehicle_id } = vehicleResult.rows[0];
               
               // Update appropriate vehicle table based on type
               if (vehicle_type === 'Car') {
                    await client.query(updateCarStatus, [vehicle_id]);
               } else if (vehicle_type === 'Bike') {
                    await client.query(updateBikeStatus, [vehicle_id]);
               }
          }

          // Update driver availability if driver exists
          await client.query(updateDriverStatus, [id]);

          await client.query('COMMIT');

          res.status(200).json({ message: 'Booking Cancelled Successfully.' });
     } catch (error) {
          console.log(error.message);
          
          await client.query('ROLLBACK');
          res.status(500).send(error.message);
     } finally {
          client.release();
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

module.exports = { createBooking, getUserBookings, cancelBooking, getCarBookings }