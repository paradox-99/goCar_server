const pool = require('../config/db');

function generatePickupId() {
    return `PIK-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const createPickup = async (req, res) => {
    const { booking_id, fuel_level, odometer_reading, early_fee, fuel_charge, pickup_notes } = req.body;

    if (!booking_id || typeof booking_id !== 'string' || !booking_id.trim()) {
        return res.status(400).json({ message: 'booking_id is required' });
    }
    if (fuel_level === undefined || fuel_level === null || fuel_level === '') {
        return res.status(400).json({ message: 'fuel_level is required' });
    }
    if (odometer_reading === undefined || odometer_reading === null || odometer_reading === '') {
        return res.status(400).json({ message: 'odometer_reading is required' });
    }

    const parsedFuel = parseFloat(fuel_level);
    const parsedOdo = parseInt(odometer_reading, 10);

    if (isNaN(parsedFuel) || parsedFuel < 0 || parsedFuel > 100) {
        return res.status(400).json({ message: 'fuel_level must be a number between 0 and 100' });
    }
    if (isNaN(parsedOdo) || parsedOdo < 0) {
        return res.status(400).json({ message: 'odometer_reading must be a non-negative integer' });
    }
    if (early_fee !== undefined && early_fee !== '' && (isNaN(parseInt(early_fee)) || parseInt(early_fee) < 0)) {
        return res.status(400).json({ message: 'early_fee must be a non-negative integer' });
    }
    if (fuel_charge !== undefined && fuel_charge !== '' && (isNaN(parseInt(fuel_charge)) || parseInt(fuel_charge) < 0)) {
        return res.status(400).json({ message: 'fuel_charge must be a non-negative integer' });
    }

    try {
        const bookingRes = await pool.query(
            `SELECT status, initial_payment, start_ts FROM booking_info WHERE booking_id = $1`,
            [booking_id.trim()]
        );

        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const booking = bookingRes.rows[0];

        if (booking.status !== 'Confirmed') {
            return res.status(400).json({ message: 'Only Confirmed bookings can initiate pickup' });
        }

        if (!booking.initial_payment) {
            return res.status(400).json({ message: 'Initial payment must be completed before initiating pickup' });
        }

        const now = new Date();
        const startTs = new Date(booking.start_ts);
        const diffHours = (startTs - now) / (1000 * 60 * 60);

        if (diffHours > 2) {
            const hoursLeft = Math.ceil(diffHours);
            return res.status(400).json({
                message: `Pickup can only be initiated within 2 hours of pickup time. ${hoursLeft} hour(s) remaining.`
            });
        }

        const existingPickup = await pool.query(
            `SELECT pickup_id FROM pickup_info WHERE booking_id = $1`,
            [booking_id.trim()]
        );

        if (existingPickup.rows.length > 0) {
            return res.status(409).json({ message: 'Pickup has already been initiated for this booking' });
        }

        const pickupId = generatePickupId();
        await pool.query(
            `INSERT INTO pickup_info (pickup_id, booking_id, pickup_time, fuel_level, odometer_reading, early_fee, fuel_charge, pickup_notes, confirmed)
             VALUES ($1, $2, now(), $3, $4, $5, $6, $7, false)`,
            [
                pickupId,
                booking_id.trim(),
                parsedFuel,
                parsedOdo,
                parseInt(early_fee) || 0,
                parseInt(fuel_charge) || 0,
                pickup_notes?.trim() || null
            ]
        );

        res.status(201).json({
            pickup_id: pickupId,
            message: 'Pickup initiated successfully. Waiting for customer confirmation.'
        });
    } catch (err) {
        console.error('createPickup error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getPickupByBookingId = async (req, res) => {
    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
        return res.status(400).json({ message: 'bookingId is required' });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM pickup_info WHERE booking_id = $1`,
            [bookingId.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No pickup record found for this booking' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('getPickupByBookingId error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const confirmPickup = async (req, res) => {
    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
        return res.status(400).json({ message: 'bookingId is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pickupRes = await client.query(
            `SELECT pi.pickup_id, pi.confirmed, bi.status
             FROM pickup_info pi
             JOIN booking_info bi ON pi.booking_id = bi.booking_id
             WHERE pi.booking_id = $1`,
            [bookingId.trim()]
        );

        if (pickupRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Pickup record not found for this booking' });
        }

        const { confirmed, status } = pickupRes.rows[0];

        if (confirmed) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Pickup has already been confirmed' });
        }

        if (status !== 'Confirmed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Booking is not in Confirmed status' });
        }

        await client.query(
            `UPDATE pickup_info SET confirmed = true WHERE booking_id = $1`,
            [bookingId.trim()]
        );

        await client.query(
            `UPDATE booking_info SET status = 'Running' WHERE booking_id = $1`,
            [bookingId.trim()]
        );

        await client.query('COMMIT');

        res.json({ message: 'Pickup confirmed. Your trip has started!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('confirmPickup error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

module.exports = { createPickup, getPickupByBookingId, confirmPickup };
