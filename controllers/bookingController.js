const pool = require('../config/db')
const { generateBookingId } = require('./createIDs')
const { sendBookingNotification, sendStatusUpdateNotification } = require('../services/notificationService')

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

          const result = await client.query(query, [
               booking_id,
               vehicle_type,
               vehicle_id,
               start_ts,
               end_ts,
               total_rent_hours,
               driver_cost || 0,
               total_cost,
               driver_id || null,
               status,
               user_id,
               booking_purpose,
               estimated_destination
          ]);
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

          // Trigger asynchronous notifications
          sendBookingNotification({
               vehicle_id,
               driver_id,
               booking_id,
               start_ts,
               end_ts
          }).catch(err => console.error("Notification trigger error:", err));

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
          SELECT 
               booking_info.*, 
               COALESCE(cars.brand, bikes.brand) as brand, 
               COALESCE(cars.model, bikes.model) as model, 
               COALESCE(cars.car_type, bikes.car_type) as car_type, 
               COALESCE(cars.images, bikes.images) as images, 
               cars.seats, 
               COALESCE(cars.fuel, bikes.fuel) as fuel, 
               COALESCE(cars.mileage, bikes.mileage) as mileage, 
               COALESCE(cars.gear, bikes.gear) as gear, 
               COALESCE(cars.rental_price, bikes.rental_price) as vehicle_rental_price, 
               cars.transmission_type, 
               agencies.agency_name, 
               agencies.phone_number as agency_phone, 
               agencies.email as agency_email, 
               driver_info.name as driver_name, 
               driver_info.email as driver_email, 
               driver_info.phone as driver_phone, 
               driver_info.photo as driver_photo, 
               driver_info.experience_year as driver_experience, 
               driver_info.rating as driver_rating, 
               driver_info.rental_price as driver_rental_price, 
               agadd.display_name as agency_address, 
               driadd.display_name as driver_address, u.name as user_name, u.email as user_email, u.phone as user_phone
          FROM booking_info JOIN users u ON booking_info.user_id = u.user_id
          LEFT JOIN cars ON booking_info.vehicle_id = cars.car_id AND LOWER(booking_info.vehicle_type::text) = 'car'
          LEFT JOIN bikes ON booking_info.vehicle_id = bikes.bike_id AND LOWER(booking_info.vehicle_type::text) = 'bike'
          LEFT JOIN agencies ON COALESCE(cars.agency_id, bikes.agency_id) = agencies.agency_id
          LEFT JOIN address as agadd ON agencies.address_id = agadd.address_id
          LEFT JOIN driver_info ON booking_info.driver_id = driver_info.driver_id
          LEFT JOIN address as driadd ON driver_info.address_id = driadd.address_id
          WHERE booking_info.user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          console.error("Error in getUserBookings:", error);
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
               if (vehicle_type === 'car') {
                    await client.query(updateCarStatus, [vehicle_id]);
               } else if (vehicle_type === 'bike') {
                    await client.query(updateBikeStatus, [vehicle_id]);
               }
          }

          // Update driver availability if driver exists
          await client.query(updateDriverStatus, [id]);

          await client.query('COMMIT');

          // Trigger notification
          sendStatusUpdateNotification(id, 'Cancelled').catch(err => console.error("Notification trigger error:", err));

          res.status(200).json({ message: 'Booking Cancelled Successfully.', code: 1 });
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
          JOIN users ON booking_info.user_id = users.user_id)
          WHERE booking_info.vehicle_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getDriverBookings = async (req, res) => {
     const id = req.params.id;
     const query = `
          SELECT 
               booking_info.*, 
               COALESCE(cars.brand, bikes.brand) as brand, 
               COALESCE(cars.model, bikes.model) as model, 
               COALESCE(cars.car_type, bikes.car_type) as car_type, 
               COALESCE(cars.images, bikes.images) as images, 
               cars.seats, 
               COALESCE(cars.fuel, bikes.fuel) as fuel, 
               COALESCE(cars.mileage, bikes.mileage) as mileage, 
               COALESCE(cars.gear, bikes.gear) as gear, 
               COALESCE(cars.rental_price, bikes.rental_price) as vehicle_rental_price, 
               cars.transmission_type, 
               agencies.agency_name, 
               agencies.phone_number as agency_phone, 
               agencies.email as agency_email, 
               users.name as user_name, 
               users.email as user_email, 
               users.phone as user_phone, 
               users.photo as user_photo, 
               agadd.display_name as agency_address,
               useradd.display_name as user_address
          FROM booking_info
          LEFT JOIN cars ON booking_info.vehicle_id = cars.car_id AND LOWER(booking_info.vehicle_type::text) = 'car'
          LEFT JOIN bikes ON booking_info.vehicle_id = bikes.bike_id AND LOWER(booking_info.vehicle_type::text) = 'bike'
          LEFT JOIN agencies ON COALESCE(cars.agency_id, bikes.agency_id) = agencies.agency_id
          LEFT JOIN address as agadd ON agencies.address_id = agadd.address_id
          LEFT JOIN users ON booking_info.user_id = users.user_id
          LEFT JOIN address as useradd ON users.address_id = useradd.address_id
          WHERE booking_info.driver_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          console.error("Error in getDriverBookings:", error);
          res.status(500).send(error.message);
     }
}

const updateBookingStatus = async (req, res) => {
     const id = req.params.id;
     const { status } = req.body;
     
     if (!status) {
          return res.status(400).json({ message: 'Status is required.' });
     }

     const client = await pool.connect();

     try {
          await client.query('BEGIN');

          const query = `
               UPDATE booking_info
               SET status = $2
               WHERE booking_id = $1
               RETURNING *
          `;
          
          const result = await client.query(query, [id, status]);
          if (result.rowCount === 0) {
               await client.query('ROLLBACK');
               return res.status(404).json({ message: 'Booking not found.' });
          }

          const booking = result.rows[0];

          // If status is updated to Cancelled or Completed, make vehicle and driver available again
          if (status === 'Cancelled' || status === 'Completed') {
               if (booking.vehicle_type === 'car') {
                    await client.query("UPDATE cars SET status = 'Available' WHERE car_id = $1", [booking.vehicle_id]);
               } else if (booking.vehicle_type === 'bike') {
                    await client.query("UPDATE bikes SET status = 'Available' WHERE bike_id = $1", [booking.vehicle_id]);
               }

               if (booking.driver_id) {
                    await client.query("UPDATE driver_info SET availability = true WHERE driver_id = $1", [booking.driver_id]);
               }
          }

          await client.query('COMMIT');

          // Trigger notification
          sendStatusUpdateNotification(id, status).catch(err => console.error("Notification trigger error:", err));

          res.status(200).json({ 
               message: `Status updated to ${status} successfully.`, 
               booking: booking
          });
     } catch (error) {
          await client.query('ROLLBACK');
          console.error("Error updating booking status:", error);
          res.status(500).send(error.message);
     } finally {
          client.release();
     }
}

const getBookingById = async (req, res) => {
     const id = req.params.id;
     const query = `
          SELECT 
               booking_info.*, 
               COALESCE(cars.brand, bikes.brand) as brand, 
               COALESCE(cars.model, bikes.model) as model, 
               COALESCE(cars.car_type, bikes.car_type) as car_type, 
               COALESCE(cars.images, bikes.images) as images, 
               cars.seats, 
               COALESCE(cars.fuel, bikes.fuel) as fuel, 
               COALESCE(cars.mileage, bikes.mileage) as mileage, 
               COALESCE(cars.gear, bikes.gear) as gear, 
               COALESCE(cars.rental_price, bikes.rental_price) as vehicle_rental_price, 
               cars.transmission_type, 
               agencies.agency_name, 
               agencies.phone_number as agency_phone, 
               agencies.email as agency_email, 
               users.name as user_name, 
               users.email as user_email, 
               users.phone as user_phone, 
               users.photo as user_photo, 
               agadd.display_name as agency_address,
               useradd.display_name as user_address,
               driver_info.name as driver_name,
               driver_info.phone as driver_phone,
               driver_info.photo as driver_photo
          FROM booking_info
          LEFT JOIN cars ON booking_info.vehicle_id = cars.car_id AND LOWER(booking_info.vehicle_type::text) = 'car'
          LEFT JOIN bikes ON booking_info.vehicle_id = bikes.bike_id AND LOWER(booking_info.vehicle_type::text) = 'bike'
          LEFT JOIN agencies ON COALESCE(cars.agency_id, bikes.agency_id) = agencies.agency_id
          LEFT JOIN address as agadd ON agencies.address_id = agadd.address_id
          LEFT JOIN users ON booking_info.user_id = users.user_id
          LEFT JOIN address as useradd ON users.address_id = useradd.address_id
          LEFT JOIN driver_info ON booking_info.driver_id = driver_info.driver_id
          WHERE booking_info.booking_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          if (result.rowCount === 0) {
               return res.status(404).json({ message: 'Booking not found.' });
          }
          res.json(result.rows[0]);
     } catch (error) {
          console.error("Error in getBookingById:", error);
          res.status(500).send(error.message);
     }
}

const checkAvailability = async (req, res) => {
     const { vehicle_id, vehicle_type, start_ts, end_ts } = req.body;

     const query = `
          SELECT booking_id, start_ts, end_ts
          FROM booking_info
          WHERE vehicle_id = $1 
          AND vehicle_type = $2 
          AND status NOT IN ('Cancelled')
          AND (($3 < end_ts) AND ($4 > start_ts))
     `;

     const nextAvailableQuery = `
          SELECT MAX(end_ts) as next_available 
          FROM booking_info
          WHERE vehicle_id = $1 
          AND vehicle_type = $2 
          AND status NOT IN ('Cancelled')
          AND end_ts > $3
     `;

     try {
          const overlaps = await pool.query(query, [vehicle_id, vehicle_type, start_ts, end_ts]);
          
          if (overlaps.rowCount > 0) {
               const nextAvailable = await pool.query(nextAvailableQuery, [vehicle_id, vehicle_type, start_ts]);
               return res.status(200).json({
                    available: false,
                    message: 'Vehicle is already booked for this period.',
                    nextAvailable: nextAvailable.rows[0].next_available
               });
          }

          res.status(200).json({ 
               available: true, 
               message: 'Vehicle is available.' 
          });
     } catch (error) {
          console.error(error.message);
          res.status(500).send(error.message);
     }
}

module.exports = { createBooking, getUserBookings, cancelBooking, getCarBookings, updateBookingStatus, getDriverBookings, getBookingById, checkAvailability }
