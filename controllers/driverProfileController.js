const pool = require('../config/db');
const { createAddressId } = require('./createIDs');

const getDriverFullProfile = async (req, res) => {
    const { email } = req.params;
    try {
        const [profileRes, statsRes, ratingRes] = await Promise.all([
            pool.query(`
                SELECT d.*,
                    a.city, a.area, a.postcode, a.latitude, a.longitude, a.display_name,
                    ag.agency_name,
                    aa.city AS agency_city, aa.area AS agency_area
                FROM driver_info d
                LEFT JOIN address a ON d.address_id = a.address_id
                LEFT JOIN agencies ag ON d.agency_id = ag.agency_id
                LEFT JOIN address aa ON ag.address_id = aa.address_id
                WHERE d.email = $1
            `, [email]),
            pool.query(`
                SELECT
                    COUNT(*)::int AS total_trips,
                    COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_trips,
                    COALESCE(SUM(driver_cost) FILTER (WHERE status = 'Completed'), 0)::bigint AS total_earned
                FROM booking_info
                WHERE driver_id = (SELECT driver_id FROM driver_info WHERE email = $1)
            `, [email]),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE rating = 5)::int AS r5,
                    COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
                    COUNT(*) FILTER (WHERE rating = 3)::int AS r3,
                    COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
                    COUNT(*) FILTER (WHERE rating = 1)::int AS r1,
                    COUNT(*)::int AS total,
                    ROUND(AVG(rating)::numeric, 2)::float AS avg_rating,
                    ROUND(AVG(rating) FILTER (WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL'1 month')
                        AND date < DATE_TRUNC('month', CURRENT_DATE))::numeric, 2)::float AS prev_month_avg,
                    ROUND(AVG(rating) FILTER (WHERE date >= DATE_TRUNC('month', CURRENT_DATE))::numeric, 2)::float AS this_month_avg
                FROM driver_reviews
                WHERE driver_id = (SELECT driver_id FROM driver_info WHERE email = $1)
            `, [email]),
        ]);

        const profile = profileRes.rows[0];
        if (!profile) return res.status(404).json({ error: 'Driver not found' });

        const stats = statsRes.rows[0];
        const rating = ratingRes.rows[0];

        res.json({
            ...profile,
            stats: {
                totalTrips: stats.total_trips,
                completedTrips: stats.completed_trips,
                totalEarned: parseInt(stats.total_earned),
            },
            ratingBreakdown: {
                total: rating.total,
                avg: parseFloat(rating.avg_rating || 0),
                r5: rating.r5, r4: rating.r4, r3: rating.r3, r2: rating.r2, r1: rating.r1,
                prevMonthAvg: parseFloat(rating.prev_month_avg || 0),
                thisMonthAvg: parseFloat(rating.this_month_avg || 0),
            }
        });
    } catch (err) {
        console.error('getDriverFullProfile:', err);
        res.status(500).json({ error: err.message });
    }
};

const getDriverReviews = async (req, res) => {
    const { driverId } = req.params;
    const { page = 1, rating, sort = 'newest' } = req.query;
    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;

    const orderBy = sort === 'oldest'  ? 'dr.date ASC'
                  : sort === 'highest' ? 'dr.rating DESC, dr.date DESC'
                  : sort === 'lowest'  ? 'dr.rating ASC, dr.date DESC'
                  : 'dr.date DESC';

    const ratingFilter = rating && rating !== 'all' ? `AND dr.rating = ${parseInt(rating)}` : '';

    try {
        const [reviewsRes, countRes] = await Promise.all([
            pool.query(`
                SELECT dr.*, u.name AS reviewer_name, u.photo AS reviewer_photo,
                       bi.start_ts, bi.end_ts
                FROM driver_reviews dr
                LEFT JOIN users u ON dr.user_id = u.user_id
                LEFT JOIN LATERAL (
                    SELECT start_ts, end_ts FROM booking_info
                    WHERE driver_id = dr.driver_id AND user_id = dr.user_id AND status = 'Completed'
                    ORDER BY end_ts DESC LIMIT 1
                ) bi ON true
                WHERE dr.driver_id = $1 ${ratingFilter}
                ORDER BY ${orderBy}
                LIMIT $2 OFFSET $3
            `, [driverId, limit, offset]),
            pool.query(`
                SELECT COUNT(*)::int AS total FROM driver_reviews dr
                WHERE dr.driver_id = $1 ${ratingFilter}
            `, [driverId])
        ]);

        res.json({
            reviews: reviewsRes.rows,
            total: countRes.rows[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countRes.rows[0].total / limit),
        });
    } catch (err) {
        console.error('getDriverReviews:', err);
        res.status(500).json({ error: err.message });
    }
};

const updatePersonalInfo = async (req, res) => {
    const { driverId } = req.params;
    const { name, phone, gender, dob, nid } = req.body;
    try {
        await pool.query(
            `UPDATE driver_info SET name=$1, phone=$2, gender=$3, dob=$4, nid=$5 WHERE driver_id=$6`,
            [name, phone, gender || null, dob || null, nid || null, driverId]
        );
        res.json({ message: 'Personal info updated' });
    } catch (err) {
        console.error('updatePersonalInfo:', err);
        res.status(500).json({ error: err.message });
    }
};

const updateAddress = async (req, res) => {
    const { driverId } = req.params;
    const { city, area, postcode, addressId } = req.body;
    try {
        if (addressId) {
            await pool.query(
                `UPDATE address SET city=$1, area=$2, postcode=$3, display_name=$4 WHERE address_id=$5`,
                [city, area, postcode || null, `${area}, ${city}`, addressId]
            );
        } else {
            const newAddrId = createAddressId();
            await pool.query(
                `INSERT INTO address (address_id, city, area, postcode, display_name) VALUES ($1,$2,$3,$4,$5)`,
                [newAddrId, city, area, postcode || null, `${area}, ${city}`]
            );
            await pool.query(
                `UPDATE driver_info SET address_id=$1 WHERE driver_id=$2`,
                [newAddrId, driverId]
            );
        }
        res.json({ message: 'Address updated' });
    } catch (err) {
        console.error('updateAddress:', err);
        res.status(500).json({ error: err.message });
    }
};

const updateLicensePro = async (req, res) => {
    const { driverId } = req.params;
    const { license_number, license_status, expire_date, experience_year, rental_price } = req.body;
    try {
        await pool.query(
            `UPDATE driver_info SET license_number=$1, license_status=$2, expire_date=$3, experience_year=$4, rental_price=$5 WHERE driver_id=$6`,
            [license_number || null, license_status || null, expire_date || null, experience_year ?? null, rental_price ?? null, driverId]
        );
        res.json({ message: 'License & professional info updated' });
    } catch (err) {
        console.error('updateLicensePro:', err);
        res.status(500).json({ error: err.message });
    }
};

const updatePhoto = async (req, res) => {
    const { driverId } = req.params;
    const { photo } = req.body;
    try {
        await pool.query(`UPDATE driver_info SET photo=$1 WHERE driver_id=$2`, [photo, driverId]);
        res.json({ message: 'Photo updated' });
    } catch (err) {
        console.error('updatePhoto:', err);
        res.status(500).json({ error: err.message });
    }
};

const deactivateAccount = async (req, res) => {
    const { driverId } = req.params;
    try {
        await pool.query(`UPDATE driver_info SET accountstatus='Inactive' WHERE driver_id=$1`, [driverId]);
        res.json({ message: 'Account deactivated' });
    } catch (err) {
        console.error('deactivateAccount:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getDriverFullProfile,
    getDriverReviews,
    updatePersonalInfo,
    updateAddress,
    updateLicensePro,
    updatePhoto,
    deactivateAccount,
};
