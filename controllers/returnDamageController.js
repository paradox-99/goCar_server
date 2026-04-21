const pool = require('../config/db');
const { generateBookingId } = require('./createIDs');

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
     const { booking_id, car_id, reported_by, damage_type, severity, description, photos, estimated_cost } = req.body;
     const damageId = `DMG-${generateBookingId()}`;
     try {
          await pool.query(
               `INSERT INTO damage_reports
               (damage_id, booking_id, car_id, reported_by, report_date, damage_type, severity, description, photos, estimated_cost, status)
               VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8, $9, 'reported')`,
               [damageId, booking_id, car_id, reported_by, damage_type, severity || 'minor', description || null, photos || null, estimated_cost || 0]
          );
          res.status(201).json({ damage_id: damageId, message: 'Damage report created' });
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

module.exports = { createPickup, createReturn, reportDamage, getUserDamageReports };
