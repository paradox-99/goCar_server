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
               driadd.display_name as driver_address, u.name as user_name, u.email as user_email, u.phone as user_phone,
               pi.pickup_id,
               pi.pickup_time,
               pi.fuel_level as pickup_fuel_level,
               pi.odometer_reading as pickup_odometer,
               pi.early_fee as pickup_early_fee,
               pi.fuel_charge as pickup_fuel_charge,
               pi.pickup_notes,
               pi.confirmed as pickup_confirmed,
               ri.return_id,
               ri.return_time,
               ri.fuel_level as return_fuel_level,
               ri.odometer_reading as return_odometer,
               ri.late_fee,
               ri.fuel_charge as return_fuel_charge,
               ri.cleaning_charge,
               ri.return_notes,
               ri.confirmed as return_confirmed
          FROM booking_info JOIN users u ON booking_info.user_id = u.user_id
          LEFT JOIN cars ON booking_info.vehicle_id = cars.car_id AND LOWER(booking_info.vehicle_type::text) = 'car'
          LEFT JOIN bikes ON booking_info.vehicle_id = bikes.bike_id AND LOWER(booking_info.vehicle_type::text) = 'bike'
          LEFT JOIN agencies ON COALESCE(cars.agency_id, bikes.agency_id) = agencies.agency_id
          LEFT JOIN address as agadd ON agencies.address_id = agadd.address_id
          LEFT JOIN driver_info ON booking_info.driver_id = driver_info.driver_id
          LEFT JOIN address as driadd ON driver_info.address_id = driadd.address_id
          LEFT JOIN pickup_info pi ON booking_info.booking_id = pi.booking_id
          LEFT JOIN return_info ri ON booking_info.booking_id = ri.booking_id
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

const getAdminFilteredBookings = async (req, res) => {
    const { 
        search, status, vehicle_type, 
        created_start, created_end, 
        trip_start, trip_end,
        payment_status, driver_status, cancelled_by,
        quick_filter,
        page = 0, limit = 8 
    } = req.query;
    
    const offset = page * limit;
    let params = [];
    let whereClauses = [];

    // Quick Filters Logic
    if (quick_filter) {
        switch (quick_filter) {
            case 'Today':
                whereClauses.push(`b.booking_ts::date = current_date`);
                break;
            case 'Week':
                whereClauses.push(`b.booking_ts >= current_date - interval '7 days'`);
                break;
            case 'Unpaid':
                whereClauses.push(`(b.initial_payment = false OR b.final_payment = false)`);
                break;
            case 'WithDriver':
                whereClauses.push(`b.driver_id IS NOT NULL`);
                break;
            case 'CancelledByUser':
                whereClauses.push(`b.cancelled_by = 'User'`);
                break;
            case 'CancelledByAgency':
                whereClauses.push(`b.cancelled_by = 'Agency'`);
                break;
            case 'CancelledByAdmin':
                whereClauses.push(`b.cancelled_by = 'Admin'`);
                break;
            case 'HasDamage':
                whereClauses.push(`EXISTS (SELECT 1 FROM damage_reports dr WHERE dr.booking_id = b.booking_id)`);
                break;
            case 'Overdue':
                whereClauses.push(`(b.status = 'Overdue' OR (b.status IN ('Running', 'Confirmed') AND b.end_ts < now()))`);
                break;
        }
    }

    if (search) {
        params.push(`%${search}%`);
        const pIdx = params.length;
        whereClauses.push(`(
            b.booking_id ILIKE $${pIdx} OR 
            u.name ILIKE $${pIdx} OR 
            c.brand ILIKE $${pIdx} OR c.model ILIKE $${pIdx} OR
            bk.brand ILIKE $${pIdx} OR bk.model ILIKE $${pIdx}
        )`);
    }

    if (status && status !== 'All') {
        params.push(status);
        whereClauses.push(`b.status = $${params.length}`);
    }

    if (vehicle_type) {
        params.push(vehicle_type);
        whereClauses.push(`b.vehicle_type = $${params.length}`);
    }

    if (created_start && created_end) {
        params.push(created_start, created_end);
        whereClauses.push(`b.booking_ts::date BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    if (trip_start && trip_end) {
        params.push(trip_start, trip_end);
        whereClauses.push(`b.start_ts >= $${params.length - 1} AND b.end_ts <= $${params.length}`);
    }

    if (payment_status && payment_status !== 'All') {
        if (payment_status === 'Initial Paid') whereClauses.push(`b.initial_payment = true`);
        else if (payment_status === 'Initial Not Paid') whereClauses.push(`b.initial_payment = false`);
        else if (payment_status === 'Final Paid') whereClauses.push(`b.final_payment = true`);
        else if (payment_status === 'Final Not Paid') whereClauses.push(`b.final_payment = false`);
        else if (payment_status === 'Fully Paid') whereClauses.push(`b.initial_payment = true AND b.final_payment = true`);
    }

    if (driver_status && driver_status !== 'All') {
        if (driver_status === 'With Driver') whereClauses.push(`b.driver_id IS NOT NULL`);
        else if (driver_status === 'Without Driver') whereClauses.push(`b.driver_id IS NULL`);
    }

    if (cancelled_by && cancelled_by !== 'All') {
        params.push(cancelled_by);
        whereClauses.push(`b.cancelled_by = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
        SELECT 
            b.*, 
            u.name as user_name, u.phone as user_phone,
            COALESCE(c.brand, bk.brand) as brand, 
            COALESCE(c.model, bk.model) as model, 
            COALESCE(c.images, bk.images) as images,
            ag.agency_name,
            d.name as driver_name,
            (SELECT COUNT(*) FROM damage_reports dr WHERE dr.booking_id = b.booking_id) as damage_count
        FROM booking_info b
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
        LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
        LEFT JOIN agencies ag ON COALESCE(c.agency_id, bk.agency_id) = ag.agency_id
        LEFT JOIN driver_info d ON b.driver_id = d.driver_id
        ${whereSql}
        ORDER BY b.booking_ts DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
        SELECT COUNT(*) 
        FROM booking_info b
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
        LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
        ${whereSql}
    `;

    try {
        const countRes = await pool.query(countQuery, params);
        const totalCount = parseInt(countRes.rows[0].count);
        const result = await pool.query(query, [...params, limit, offset]);

        res.json({
            bookings: result.rows,
            totalCount
        });
    } catch (error) {
        console.error("Error in getAdminFilteredBookings:", error);
        res.status(500).send(error.message);
    }
};

const getAdminBookingStats = async (req, res) => {
    const { vehicle_type } = req.query;
    try {
        const query = `
            SELECT 
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN b.status = 'Running' THEN 1 END) as running,
                COUNT(CASE WHEN b.status = 'Requested' THEN 1 END) as requested,
                COUNT(CASE WHEN b.status = 'Confirmed' THEN 1 END) as confirmed,
                COUNT(CASE WHEN b.status = 'Completed' THEN 1 END) as completed,
                COUNT(CASE WHEN b.status = 'Cancelled' THEN 1 END) as cancelled,
                COUNT(CASE WHEN b.status = 'Overdue' OR (b.status IN ('Running', 'Confirmed') AND b.end_ts < now()) THEN 1 END) as overdue,
                COUNT(CASE WHEN b.status = 'Cancelled' AND b.cancelled_by = 'User' THEN 1 END) as cancelled_by_user,
                COUNT(CASE WHEN b.status = 'Cancelled' AND b.cancelled_by = 'Agency' THEN 1 END) as cancelled_by_agency,
                COUNT(CASE WHEN b.status = 'Cancelled' AND b.cancelled_by = 'Admin' THEN 1 END) as cancelled_by_admin,
                SUM(CASE WHEN b.status = 'Completed' THEN b.total_cost ELSE 0 END) as total_revenue
            FROM booking_info b
            LEFT JOIN users u ON b.user_id = u.user_id
            WHERE b.vehicle_type = $1
        `;
        const result = await pool.query(query, [vehicle_type]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error in getAdminBookingStats:", error);
        res.status(500).send(error.message);
    }
};

const getAdminBookingDetails = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Overview, Customer, Driver, Vehicle
        const mainQuery = `
            SELECT 
                b.*, 
                u.name as user_name, u.email as user_email, u.phone as user_phone, u.photo as user_photo, u.accountstatus as user_status, u.verified as user_verified,
                COALESCE(c.brand, bk.brand) as brand, COALESCE(c.model, bk.model) as model, COALESCE(c.images, bk.images) as images,
                COALESCE(c.rental_price, bk.rental_price) as rental_price,
                c.seats, c.transmission_type, c.fuel, c.car_features,
                bk.engine_capacity, bk.helmet_count, bk.abs, bk.disk_brake, bk.engine_start_type,
                ag.agency_name, ag.agency_id,
                d.name as driver_name, d.phone as driver_phone, d.email as driver_email, d.photo as driver_photo, 
                d.license_status, d.rating as driver_rating
            FROM booking_info b
            JOIN users u ON b.user_id = u.user_id
            LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
            LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
            LEFT JOIN agencies ag ON COALESCE(c.agency_id, bk.agency_id) = ag.agency_id
            LEFT JOIN driver_info d ON b.driver_id = d.driver_id
            WHERE b.booking_id = $1
        `;
        const mainRes = await pool.query(mainQuery, [id]);
        if (mainRes.rowCount === 0) return res.status(404).json({ message: 'Booking not found' });

        // 2. Pickup Info
        const pickupRes = await pool.query(`SELECT * FROM pickup_info WHERE booking_id = $1`, [id]);

        // 3. Return Info
        const returnRes = await pool.query(`SELECT * FROM return_info WHERE booking_id = $1`, [id]);

        // 4. Payments
        const paymentsRes = await pool.query(`SELECT * FROM payment_info WHERE booking_id = $1 ORDER BY payment_ts DESC`, [id]);

        // 5. Damage Reports
        const damageRes = await pool.query(`
            SELECT dr.*, u.name as reported_by_name 
            FROM damage_reports dr 
            JOIN users u ON dr.reported_by = u.user_id 
            WHERE dr.booking_id = $1
        `, [id]);

        res.json({
            overview: mainRes.rows[0],
            pickup: pickupRes.rows[0] || null,
            return: returnRes.rows[0] || null,
            payments: paymentsRes.rows,
            damages: damageRes.rows
        });
    } catch (error) {
        console.error("Error in getAdminBookingDetails:", error);
        res.status(500).send(error.message);
    }
};

const updateAdminBooking = async (req, res) => {
    const { id } = req.params;
    const { status, initial_payment, final_payment, driver_id, admin_note } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Get current booking info
        const currentRes = await client.query(`SELECT status, vehicle_id, vehicle_type, driver_id FROM booking_info WHERE booking_id = $1`, [id]);
        const current = currentRes.rows[0];

        // 2. Update booking_info
        const updateQuery = `
            UPDATE booking_info
            SET status = $1, initial_payment = $2, final_payment = $3, driver_id = $4
            WHERE booking_id = $5
            RETURNING *
        `;
        const result = await client.query(updateQuery, [status, initial_payment, final_payment, driver_id, id]);

        // 3. Handle availability if status changed to Cancelled/Completed
        if ((status === 'Cancelled' || status === 'Completed') && (current.status !== 'Cancelled' && current.status !== 'Completed')) {
            if (current.vehicle_type === 'Car') {
                await client.query("UPDATE cars SET status = 'Available' WHERE car_id = $1", [current.vehicle_id]);
            } else if (current.vehicle_type === 'Bike') {
                await client.query("UPDATE bikes SET status = 'Available' WHERE bike_id = $1", [current.vehicle_id]);
            }
            if (current.driver_id) {
                await client.query("UPDATE driver_info SET availability = true WHERE driver_id = $1", [current.driver_id]);
            }
        }

        // 4. Handle driver change (if driver was reassigned)
        if (driver_id !== current.driver_id) {
            if (current.driver_id) await client.query("UPDATE driver_info SET availability = true WHERE driver_id = $1", [current.driver_id]);
            if (driver_id) await client.query("UPDATE driver_info SET availability = false WHERE driver_id = $1", [driver_id]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Booking updated successfully', booking: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in updateAdminBooking:", error);
        res.status(500).send(error.message);
    } finally {
        client.release();
    }
};

module.exports = { 
    createBooking, 
    getUserBookings, 
    cancelBooking, 
    getCarBookings, 
    updateBookingStatus, 
    getDriverBookings, 
    getBookingById, 
    checkAvailability,
    getAdminFilteredBookings,
    getAdminBookingStats,
    getAdminBookingDetails,
    updateAdminBooking
}
