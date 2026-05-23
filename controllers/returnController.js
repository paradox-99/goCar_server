/**
 * MIGRATION REQUIRED — run this once in your database before using these routes:
 *
 *   ALTER TABLE return_info ADD COLUMN IF NOT EXISTS confirmed boolean DEFAULT false;
 */
const pool = require('../config/db');

function generateReturnId() {
    return `RET-${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const createReturn = async (req, res) => {
    const {
        booking_id,
        fuel_level,
        odometer_reading,
        late_fee,
        fuel_charge,
        cleaning_charge,
        return_notes
    } = req.body;

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
    if (late_fee !== undefined && late_fee !== '' && (isNaN(parseInt(late_fee)) || parseInt(late_fee) < 0)) {
        return res.status(400).json({ message: 'late_fee must be a non-negative integer' });
    }
    if (fuel_charge !== undefined && fuel_charge !== '' && (isNaN(parseInt(fuel_charge)) || parseInt(fuel_charge) < 0)) {
        return res.status(400).json({ message: 'fuel_charge must be a non-negative integer' });
    }
    if (cleaning_charge !== undefined && cleaning_charge !== '' && (isNaN(parseInt(cleaning_charge)) || parseInt(cleaning_charge) < 0)) {
        return res.status(400).json({ message: 'cleaning_charge must be a non-negative integer' });
    }

    try {
        const bookingRes = await pool.query(
            `SELECT status FROM booking_info WHERE booking_id = $1`,
            [booking_id.trim()]
        );

        if (bookingRes.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        if (bookingRes.rows[0].status !== 'Running') {
            return res.status(400).json({ message: 'Only Running bookings can initiate return' });
        }

        const existing = await pool.query(
            `SELECT return_id FROM return_info WHERE booking_id = $1`,
            [booking_id.trim()]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Return already submitted for this booking' });
        }

        const returnId = generateReturnId();
        await pool.query(
            `INSERT INTO return_info (return_id, booking_id, return_time, fuel_level, odometer_reading, late_fee, fuel_charge, cleaning_charge, return_notes, confirmed)
             VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8, false)`,
            [
                returnId,
                booking_id.trim(),
                parsedFuel,
                parsedOdo,
                parseInt(late_fee) || 0,
                parseInt(fuel_charge) || 0,
                parseInt(cleaning_charge) || 0,
                return_notes?.trim() || null
            ]
        );

        res.status(201).json({
            return_id: returnId,
            message: 'Return submitted successfully. Awaiting customer confirmation.'
        });
    } catch (err) {
        console.error('createReturn error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getReturnByBookingId = async (req, res) => {
    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
        return res.status(400).json({ message: 'bookingId is required' });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM return_info WHERE booking_id = $1`,
            [bookingId.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No return record found for this booking' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('getReturnByBookingId error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// User confirms return → booking status becomes Completed (final_payment stays false until paid)
const confirmReturn = async (req, res) => {
    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
        return res.status(400).json({ message: 'bookingId is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const returnRes = await client.query(
            `SELECT ri.return_id, ri.confirmed, bi.status
             FROM return_info ri
             JOIN booking_info bi ON ri.booking_id = bi.booking_id
             WHERE ri.booking_id = $1`,
            [bookingId.trim()]
        );

        if (returnRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Return record not found for this booking' });
        }

        const { confirmed, status } = returnRes.rows[0];

        if (confirmed) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Return has already been confirmed' });
        }

        if (status !== 'Running') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Booking is not in Running status' });
        }

        await client.query(
            `UPDATE return_info SET confirmed = true WHERE booking_id = $1`,
            [bookingId.trim()]
        );

        await client.query(
            `UPDATE booking_info SET status = 'Completed' WHERE booking_id = $1`,
            [bookingId.trim()]
        );

        await client.query('COMMIT');

        res.json({ message: 'Return confirmed. Please complete the final payment to close the booking.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('confirmReturn error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

module.exports = { createReturn, getReturnByBookingId, confirmReturn };
