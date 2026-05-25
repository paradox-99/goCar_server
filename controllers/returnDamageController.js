const pool = require('../config/db');
const { generateBookingId, generateDamageId } = require('./createIDs');
const { createNotification, sendEmail } = require('../services/notificationService');

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

          // Fire-and-forget: notify agency owner
          (async () => {
               try {
                    const vehicleTable = isCar ? 'cars' : 'bikes';
                    const vehicleIdCol = isCar ? 'car_id' : 'bike_id';
                    const agRes = await pool.query(
                         `SELECT ag.owner_id, ag.email, ag.agency_name, v.brand, v.model
                          FROM ${vehicleTable} v
                          JOIN agencies ag ON v.agency_id = ag.agency_id
                          WHERE v.${vehicleIdCol} = $1`,
                         [booking.vehicle_id]
                    );
                    if (agRes.rowCount === 0) return;
                    const ag = agRes.rows[0];
                    const sevLabel = { Low: 'Minor', Medium: 'Moderate', High: 'Severe' }[severity] || severity;
                    const notifMsg = `New ${sevLabel} damage report submitted for ${ag.brand} ${ag.model} — Booking ${booking_id}. Type: ${damage_type}.`;
                    await createNotification(ag.owner_id, notifMsg);
                    await sendEmail(
                         ag.email,
                         ag.agency_name,
                         `New Damage Report — ${ag.brand} ${ag.model} [${sevLabel}]`,
                         notifMsg,
                         `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden;">
                              <div style="background:#f58300;padding:24px;text-align:center;">
                                   <h1 style="color:#fff;margin:0;font-size:24px;">goCar</h1>
                                   <p style="color:rgba(255,255,255,.8);margin:6px 0 0;">Damage Report Notification</p>
                              </div>
                              <div style="padding:28px;background:#fff;">
                                   <h2 style="color:#333;margin-top:0;">New Damage Report Submitted</h2>
                                   <p style="color:#666;font-size:15px;line-height:1.6;">A customer has reported damage to one of your vehicles.</p>
                                   <div style="background:#f9f9f9;padding:18px;border-radius:8px;margin:20px 0;">
                                        <table style="width:100%;border-collapse:collapse;">
                                             <tr><td style="padding:6px 0;color:#888;font-size:13px;width:40%;">Damage ID</td><td style="padding:6px 0;color:#333;font-weight:600;">${damageId}</td></tr>
                                             <tr><td style="padding:6px 0;color:#888;font-size:13px;">Booking ID</td><td style="padding:6px 0;color:#333;font-weight:600;">${booking_id}</td></tr>
                                             <tr><td style="padding:6px 0;color:#888;font-size:13px;">Vehicle</td><td style="padding:6px 0;color:#333;font-weight:600;">${ag.brand} ${ag.model}</td></tr>
                                             <tr><td style="padding:6px 0;color:#888;font-size:13px;">Damage Type</td><td style="padding:6px 0;color:#333;font-weight:600;">${damage_type}</td></tr>
                                             <tr><td style="padding:6px 0;color:#888;font-size:13px;">Severity</td><td style="padding:6px 0;font-weight:700;color:${severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#22c55e'};">${sevLabel}</td></tr>
                                             ${description ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Description</td><td style="padding:6px 0;color:#555;">${description}</td></tr>` : ''}
                                        </table>
                                   </div>
                                   <div style="margin-top:28px;text-align:center;">
                                        <a href="http://localhost:5173/dashboard/agency/damage-reports" style="background:#f58300;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">
                                             Review on Dashboard →
                                        </a>
                                   </div>
                              </div>
                              <div style="background:#f1f1f1;padding:16px;text-align:center;color:#888;font-size:11px;">
                                   &copy; 2026 goCar Rental Service. This is an automated email.
                              </div>
                         </div>`
                    );
               } catch (notifErr) {
                    console.error('Damage notification error:', notifErr.message);
               }
          })();
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
               COALESCE(c.brand, b.brand) AS brand,
               COALESCE(c.model, b.model) AS model,
               u.name as reported_by_name
          FROM damage_reports dr
          LEFT JOIN cars c ON dr.car_id = c.car_id
          LEFT JOIN bikes b ON dr.bike_id = b.bike_id
          JOIN users u ON dr.reported_by = u.user_id
          WHERE COALESCE(c.agency_id, b.agency_id) = $1
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
