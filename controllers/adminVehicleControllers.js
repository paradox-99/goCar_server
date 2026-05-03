const pool = require('../config/db');

const adminGetAllCars = async (req, res) => {
    try {
        const query = `
            SELECT c.*, a.agency_name, cd.license_number, cd.expire_date, cd.insurance_ending_date
            FROM cars c
            LEFT JOIN agencies a ON c.agency_id = a.agency_id
            LEFT JOIN cars_documentation cd ON c.car_id = cd.car_id
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const adminGetAllBikes = async (req, res) => {
    try {
        const query = `
            SELECT b.*, a.agency_name, bd.license_number, bd.expire_date, bd.insurance_ending_date
            FROM bikes b
            LEFT JOIN agencies a ON b.agency_id = a.agency_id
            LEFT JOIN motorbike_documentation bd ON b.bike_id = bd.bike_id
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const adminGetCarDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const carQuery = `
            SELECT c.*, a.agency_name
            FROM cars c
            LEFT JOIN agencies a ON c.agency_id = a.agency_id
            WHERE c.car_id = $1
        `;
        const docQuery = `SELECT * FROM cars_documentation WHERE car_id = $1`;
        const bookingQuery = `
            SELECT b.booking_id, u.name as user_name, d.name as driver_name, b.start_ts, b.end_ts, b.total_cost, b.status
            FROM booking_info b
            LEFT JOIN users u ON b.user_id = u.user_id
            LEFT JOIN driver_info d ON b.driver_id = d.driver_id
            WHERE b.vehicle_id = $1
        `;
        const damageQuery = `
            SELECT d.*, u.name as user_name
            FROM damage_reports d
            LEFT JOIN users u ON d.reported_by = u.user_id
            WHERE d.car_id = $1
        `;
        const reviewQuery = `
            SELECT r.*, u.name as user_name
            FROM cars_reviews r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.car_id = $1
        `;

        const [car, doc, bookings, damages, reviews] = await Promise.all([
            pool.query(carQuery, [id]),
            pool.query(docQuery, [id]),
            pool.query(bookingQuery, [id]),
            pool.query(damageQuery, [id]),
            pool.query(reviewQuery, [id])
        ]);

        res.json({
            overview: car.rows[0],
            documentation: doc.rows[0],
            bookings: bookings.rows,
            damages: damages.rows,
            reviews: reviews.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const adminGetBikeDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const bikeQuery = `
            SELECT b.*, a.agency_name
            FROM bikes b
            LEFT JOIN agencies a ON b.agency_id = a.agency_id
            WHERE b.bike_id = $1
        `;
        const docQuery = `SELECT * FROM motorbike_documentation WHERE bike_id = $1`;
        const bookingQuery = `
            SELECT b.booking_id, u.name as user_name, d.name as driver_name, b.start_ts, b.end_ts, b.total_cost, b.status
            FROM booking_info b
            LEFT JOIN users u ON b.user_id = u.user_id
            LEFT JOIN driver_info d ON b.driver_id = d.driver_id
            WHERE b.vehicle_id = $1
        `;
        const reviewQuery = `
            SELECT r.*, u.name as user_name
            FROM motorbike_reviews r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.bike_id = $1
        `;

        const [bike, doc, bookings, reviews] = await Promise.all([
            pool.query(bikeQuery, [id]),
            pool.query(docQuery, [id]),
            pool.query(bookingQuery, [id]),
            pool.query(reviewQuery, [id])
        ]);

        res.json({
            overview: bike.rows[0],
            documentation: doc.rows[0],
            bookings: bookings.rows,
            reviews: reviews.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const adminUpdateCarStatus = async (req, res) => {
    const { id } = req.params;
    const { status, verified, next_available_at, rental_price, admin_note } = req.body;
    try {
        const updateQuery = `
            UPDATE cars 
            SET status = COALESCE($1, status), 
                verified = COALESCE($2, verified),
                next_available_at = COALESCE($3, next_available_at),
                rental_price = COALESCE($4, rental_price)
            WHERE car_id = $5
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [status, verified, next_available_at, rental_price, id]);
        res.json({ message: "Car updated successfully", car: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const adminUpdateBikeStatus = async (req, res) => {
    const { id } = req.params;
    const { status, verified, next_available_at, rental_price, admin_note } = req.body;
    try {
        const updateQuery = `
            UPDATE bikes 
            SET status = COALESCE($1, status), 
                verified = COALESCE($2, verified),
                next_available_at = COALESCE($3, next_available_at),
                rental_price = COALESCE($4, rental_price)
            WHERE bike_id = $5
            RETURNING *
        `;
        const result = await pool.query(updateQuery, [status, verified, next_available_at, rental_price, id]);
        res.json({ message: "Bike updated successfully", bike: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    adminGetAllCars,
    adminGetAllBikes,
    adminGetCarDetails,
    adminGetBikeDetails,
    adminUpdateCarStatus,
    adminUpdateBikeStatus
};
