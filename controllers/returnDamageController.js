const pool = require('../config/db');
const { generateBookingId, generateDamageId } = require('./createIDs');

const createPickup = async (req, res) => {
     const { booking_id, fuel_level, odometer_reading, pickup_notes } = req.body;
     const pickupId = `PICK-${generateBookingId()}`;
     try {
          await pool.query(
               `INSERT INTO pickup_info (pickup_id, booking_id, pickup_time, fuel_level, odometer_reading, pickup_notes)
                VALUES ($1, $2, now(), $3, $4, $5)`,
               [pickupId, booking_id, fuel_level, odometer_reading, pickup_notes || null]
          );
          await pool.query(`UPDATE booking_info SET status = 'ongoing' WHERE booking_id = $1`, [booking_id]);
          res.status(201).json({ pickup_id: pickupId, message: 'Pickup recorded' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const createReturn = async (req, res) => {
     const { booking_id, fuel_level, odometer_reading, late_fee, fuel_charge, cleaning_charge, return_notes } = req.body;
     const returnId = `RET-${generateBookingId()}`;
     try {
          await pool.query(
               `INSERT INTO return_info (return_id, booking_id, return_time, fuel_level, odometer_reading, late_fee, fuel_charge, cleaning_charge, return_notes)
                VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8)`,
               [returnId, booking_id, fuel_level, odometer_reading, late_fee || 0, fuel_charge || 0, cleaning_charge || 0, return_notes || null]
          );
          await pool.query(`UPDATE booking_info SET status = 'completed', final_payment = true WHERE booking_id = $1`, [booking_id]);
          res.status(201).json({ return_id: returnId, message: 'Return recorded' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const reportDamage = async (req, res) => {
     const { booking_id, car_id, bike_id, reported_by, damage_type, severity, description, photos, estimated_cost } = req.body;
     const damageId = generateDamageId();
     try {
          await pool.query(
               `INSERT INTO damage_reports
               (damage_id, booking_id, car_id, bike_id, reported_by, report_date, damage_type, severity, description, photos, estimated_cost, status)
               VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10, 'Pending')`,
               [damageId, booking_id, car_id || null, bike_id || null, reported_by, damage_type, severity || 'Low', description || null, Array.isArray(photos) && photos.length > 0 ? photos : null, estimated_cost || 0]
          );
          res.status(201).json({ damage_id: damageId, message: 'Damage report created' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const createUserDamageReport = async (req, res) => {
     const { booking_id, user_id, damage_type, severity, description, photos } = req.body;

     if (!booking_id || !user_id || !damage_type || !severity) {
          return res.status(400).json({ message: 'booking_id, user_id, damage_type, and severity are required.' });
     }

     const damageId = generateDamageId();
     try {
          const bookingRes = await pool.query(
               `SELECT vehicle_id, vehicle_type, user_id FROM booking_info WHERE booking_id = $1`,
               [booking_id]
          );

          if (bookingRes.rows.length === 0) {
               return res.status(404).json({ message: 'Booking not found.' });
          }

          const booking = bookingRes.rows[0];

          if (booking.user_id !== user_id) {
               return res.status(403).json({ message: 'You are not authorized to report damage for this booking.' });
          }

          // Check if booking is Running via a fresh status fetch
          const statusRes = await pool.query(
               `SELECT status FROM booking_info WHERE booking_id = $1`,
               [booking_id]
          );
          if (statusRes.rows[0]?.status !== 'Running') {
               return res.status(400).json({ message: 'Damage reports can only be submitted for bookings that are currently running.' });
          }

          const isCar   = booking.vehicle_type === 'Car';
          const car_id  = isCar  ? booking.vehicle_id : null;
          const bike_id = !isCar ? booking.vehicle_id : null;

          // pg driver converts a JS array directly to a Postgres text[] literal
          const photosValue = Array.isArray(photos) && photos.length > 0 ? photos : null;

          await pool.query(
               `INSERT INTO damage_reports
               (damage_id, booking_id, car_id, bike_id, reported_by, report_date, damage_type, severity, description, photos, status)
               VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, 'Pending')`,
               [damageId, booking_id, car_id, bike_id, user_id, damage_type, severity, description || null, photosValue]
          );

          res.status(201).json({ damage_id: damageId, message: 'Damage report submitted successfully.' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const getUserDamageReports = async (req, res) => {
     const userId = req.params.userId;
     const query = `
          SELECT 
               dr.*, 
               c.brand, 
               c.model, 
               c.images as car_images,
               b.booking_id
          FROM damage_reports dr
          JOIN booking_info b ON dr.booking_id = b.booking_id
          LEFT JOIN cars c ON dr.car_id = c.car_id
          WHERE dr.reported_by = $1
          ORDER BY dr.report_date DESC
     `
     try {
          const result = await pool.query(query, [userId]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const getAgencyDamageReports = async (req, res) => {
     const agencyId = req.params.agencyId;
     const query = `
          SELECT 
               dr.*, 
               c.brand, 
               c.model, 
               u.name as reported_by_name
          FROM damage_reports dr
          JOIN cars c ON dr.car_id = c.car_id
          JOIN users u ON dr.reported_by = u.user_id
          WHERE c.agency_id = $1
          ORDER BY dr.report_date DESC
     `;
     try {
          const result = await pool.query(query, [agencyId]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
};

const updateDamageStatus = async (req, res) => {
     const { damageId } = req.params;
     const { status } = req.body;
     try {
          await pool.query(
               `UPDATE damage_reports SET status = $1 WHERE damage_id = $2`,
               [status, damageId]
          );
          res.json({ message: 'Damage status updated' });
     } catch (error) {
          res.status(500).send(error.message);
     }
};

module.exports = { createPickup, createReturn, reportDamage, createUserDamageReport, getUserDamageReports, getAgencyDamageReports, updateDamageStatus };
