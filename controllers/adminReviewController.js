const pool = require('../config/db');

/**
 * Get overall review stats for the admin dashboard
 */
const getAdminReviewStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT
                (SELECT COUNT(*) FROM cars_reviews) +
                (SELECT COUNT(*) FROM motorbike_reviews) +
                (SELECT COUNT(*) FROM agency_reviews) +
                (SELECT COUNT(*) FROM driver_reviews) as total_reviews,
                (SELECT AVG(rating) FROM cars_reviews) as avg_car_rating,
                (SELECT AVG(rating) FROM motorbike_reviews) as avg_bike_rating,
                (SELECT AVG(rating) FROM agency_reviews) as avg_agency_rating,
                (SELECT AVG(rating) FROM driver_reviews) as avg_driver_rating,
                (
                    SELECT COUNT(*) FROM (
                        SELECT rating FROM cars_reviews WHERE rating < 3.0
                        UNION ALL
                        SELECT rating FROM motorbike_reviews WHERE rating < 3.0
                        UNION ALL
                        SELECT rating FROM agency_reviews WHERE rating < 3.0
                        UNION ALL
                        SELECT rating FROM driver_reviews WHERE rating < 3.0
                    ) as low_ratings
                ) as low_rated_count
        `;

        const result = await pool.query(statsQuery);
        const stats = result.rows[0];

        res.json({
            totalReviews: parseInt(stats.total_reviews) || 0,
            avgCarRating: parseFloat(stats.avg_car_rating) || 0,
            avgBikeRating: parseFloat(stats.avg_bike_rating) || 0,
            avgAgencyRating: parseFloat(stats.avg_agency_rating) || 0,
            avgDriverRating: parseFloat(stats.avg_driver_rating) || 0,
            lowRatedCount: parseInt(stats.low_rated_count) || 0
        });
    } catch (error) {
        console.error('Error fetching admin review stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get paginated and filtered list of reviews
 */
const getAdminReviewsList = async (req, res) => {
    const { type, page = 1, limit = 10, search = '', rating, ratingRange, hasReviewText, quickFilter, start, end } = req.query;
    const offset = (page - 1) * limit;

    let query = '';
    let countQuery = '';
    let values = [];
    let whereClauses = [];
    let reviewAlias = '';

    // Base query selection based on type
    if (type === 'car') {
        reviewAlias = 'cr';
        query = `
            SELECT cr.*, u.name as reviewer_name, u.email as reviewer_email, u.photo as reviewer_photo,
                   c.brand, c.model, c.car_type, a.agency_name, c.images
            FROM cars_reviews cr
            JOIN users u ON cr.user_id = u.user_id
            JOIN cars c ON cr.car_id = c.car_id
            JOIN agencies a ON c.agency_id = a.agency_id
        `;
        countQuery = `SELECT COUNT(*) FROM cars_reviews cr JOIN users u ON cr.user_id = u.user_id JOIN cars c ON cr.car_id = c.car_id`;
        
        if (search) {
            whereClauses.push(`(c.brand ILIKE $${values.length + 1} OR c.model ILIKE $${values.length + 1} OR u.name ILIKE $${values.length + 1})`);
            values.push(`%${search}%`);
        }
    } else if (type === 'bike') {
        reviewAlias = 'mr';
        query = `
            SELECT mr.*, u.name as reviewer_name, u.email as reviewer_email, u.photo as reviewer_photo,
                   b.brand, b.model, b.car_type as bike_type, a.agency_name, b.images
            FROM motorbike_reviews mr
            JOIN users u ON mr.user_id = u.user_id
            JOIN bikes b ON mr.bike_id = b.bike_id
            JOIN agencies a ON b.agency_id = a.agency_id
        `;
        countQuery = `SELECT COUNT(*) FROM motorbike_reviews mr JOIN users u ON mr.user_id = u.user_id JOIN bikes b ON mr.bike_id = b.bike_id`;

        if (search) {
            whereClauses.push(`(b.brand ILIKE $${values.length + 1} OR b.model ILIKE $${values.length + 1} OR u.name ILIKE $${values.length + 1})`);
            values.push(`%${search}%`);
        }
    } else if (type === 'agency') {
        reviewAlias = 'ar';
        query = `
            SELECT ar.*, u.name as reviewer_name, u.email as reviewer_email, u.photo as reviewer_photo,
                   a.agency_name, a.verified, ad.city
            FROM agency_reviews ar
            JOIN users u ON ar.user_id = u.user_id
            JOIN agencies a ON ar.agency_id = a.agency_id
            LEFT JOIN address ad ON a.address_id = ad.address_id
        `;
        countQuery = `SELECT COUNT(*) FROM agency_reviews ar JOIN users u ON ar.user_id = u.user_id JOIN agencies a ON ar.agency_id = a.agency_id`;

        if (search) {
            whereClauses.push(`(a.agency_name ILIKE $${values.length + 1} OR u.name ILIKE $${values.length + 1})`);
            values.push(`%${search}%`);
        }
    } else if (type === 'driver') {
        reviewAlias = 'dr';
        query = `
            SELECT dr.*, u.name as reviewer_name, u.email as reviewer_email, u.photo as reviewer_photo,
                   di.name as driver_name, di.photo as driver_photo, di.license_status,
                   ag.agency_name
            FROM driver_reviews dr
            JOIN users u ON dr.user_id = u.user_id
            JOIN driver_info di ON dr.driver_id = di.driver_id
            LEFT JOIN agencies ag ON di.agency_id = ag.agency_id
        `;
        countQuery = `SELECT COUNT(*) FROM driver_reviews dr JOIN users u ON dr.user_id = u.user_id JOIN driver_info di ON dr.driver_id = di.driver_id`;

        if (search) {
            whereClauses.push(`(di.name ILIKE $${values.length + 1} OR u.name ILIKE $${values.length + 1})`);
            values.push(`%${search}%`);
        }
    }

    // Apply common filters
    if (rating && rating !== 'All') {
        const ratingVal = parseFloat(rating);
        whereClauses.push(`${reviewAlias}.rating >= $${values.length + 1} AND ${reviewAlias}.rating < $${values.length + 1} + 1`);
        values.push(ratingVal);
    }

    if (ratingRange && ratingRange !== 'All') {
        if (ratingRange === 'Below 2.0') whereClauses.push(`${reviewAlias}.rating < 2.0`);
        else if (ratingRange === '2.0–3.0') whereClauses.push(`${reviewAlias}.rating >= 2.0 AND ${reviewAlias}.rating < 3.0`);
        else if (ratingRange === '3.0–4.0') whereClauses.push(`${reviewAlias}.rating >= 3.0 AND ${reviewAlias}.rating < 4.0`);
        else if (ratingRange === 'Above 4.0') whereClauses.push(`${reviewAlias}.rating >= 4.0`);
    }

    if (hasReviewText && hasReviewText !== 'All') {
        if (hasReviewText === 'With Written Review') whereClauses.push(`${reviewAlias}.review IS NOT NULL AND ${reviewAlias}.review <> ''`);
        else if (hasReviewText === 'Rating Only') whereClauses.push(`(${reviewAlias}.review IS NULL OR ${reviewAlias}.review = '')`);
    }

    if (quickFilter && quickFilter !== 'All') {
        if (quickFilter === '5Star') whereClauses.push(`${reviewAlias}.rating = 5.0`);
        else if (quickFilter === '4Plus') whereClauses.push(`${reviewAlias}.rating >= 4.0`);
        else if (quickFilter === 'Low') whereClauses.push(`${reviewAlias}.rating < 3.0`);
        else if (quickFilter === '1Star') whereClauses.push(`${reviewAlias}.rating <= 1.0`);
        else if (quickFilter === 'Week') whereClauses.push(`${reviewAlias}.date >= NOW() - INTERVAL '7 days'`);
        else if (quickFilter === 'Month') whereClauses.push(`${reviewAlias}.date >= NOW() - INTERVAL '30 days'`);
        else if (quickFilter === 'HasText') whereClauses.push(`${reviewAlias}.review IS NOT NULL AND ${reviewAlias}.review <> ''`);
        else if (quickFilter === 'NoText') whereClauses.push(`(${reviewAlias}.review IS NULL OR ${reviewAlias}.review = '')`);
    }

    if (start) {
        whereClauses.push(`${reviewAlias}.date >= $${values.length + 1}`);
        values.push(start);
    }
    if (end) {
        whereClauses.push(`${reviewAlias}.date <= $${values.length + 1}`);
        values.push(end);
    }




    // Combine WHERE clauses
    if (whereClauses.length > 0) {
        const whereString = ' WHERE ' + whereClauses.join(' AND ');
        query += whereString;
        countQuery += whereString;
    }

    // Sorting and Pagination
    query += ` ORDER BY date DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const finalValues = [...values, limit, offset];

    try {
        const listResult = await pool.query(query, finalValues);
        const countResult = await pool.query(countQuery, values);
        
        res.json({
            reviews: listResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching admin reviews list:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Delete a review and update entity stats
 */
const deleteAdminReview = async (req, res) => {
    const { type, reviewId } = req.params;
    const { user_id, entity_id, rating } = req.query; // Need these to update entity stats
    const { reason } = req.body;

    let table = '';
    let idColumn = '';
    let entityTable = '';
    let entityIdColumn = '';

    if (type === 'car') {
        table = 'cars_reviews';
        idColumn = 'car_id';
        entityTable = 'cars';
        entityIdColumn = 'car_id';
    } else if (type === 'bike') {
        table = 'motorbike_reviews';
        idColumn = 'bike_id';
        entityTable = 'bikes';
        entityIdColumn = 'bike_id';
    } else if (type === 'agency') {
        table = 'agency_reviews';
        idColumn = 'agency_id';
        entityTable = 'agencies';
        entityIdColumn = 'agency_id';
    } else if (type === 'driver') {
        table = 'driver_reviews';
        idColumn = 'driver_id';
        entityTable = 'driver_info';
        entityIdColumn = 'driver_id';
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Delete the review
        const deleteQuery = `DELETE FROM ${table} WHERE user_id = $1 AND ${idColumn} = $2`;
        await client.query(deleteQuery, [user_id, entity_id]);

        // 2. Update entity stats
        // We need to fetch current stats first
        const entityQuery = `SELECT rating, rating_count, review_count FROM ${entityTable} WHERE ${entityIdColumn} = $1`;
        const entityResult = await client.query(entityQuery, [entity_id]);
        
        if (entityResult.rows.length > 0) {
            const { rating: oldRating, rating_count, review_count } = entityResult.rows[0];
            const newRatingCount = Math.max(0, rating_count - 1);
            const newReviewCount = Math.max(0, review_count - 1);
            
            let newAvgRating = 0;
            if (newRatingCount > 0) {
                newAvgRating = (oldRating * rating_count - parseFloat(rating)) / newRatingCount;
            }

            const updateQuery = `
                UPDATE ${entityTable} 
                SET rating = $1, rating_count = $2, review_count = $3 
                WHERE ${entityIdColumn} = $4
            `;
            await client.query(updateQuery, [newAvgRating, newRatingCount, newReviewCount, entity_id]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting admin review:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

/**
 * Get review analytics for charts
 */
const getAdminReviewAnalytics = async (req, res) => {
    const { type } = req.query;
    let table = '';
    if (type === 'car') table = 'cars_reviews';
    else if (type === 'bike') table = 'motorbike_reviews';
    else if (type === 'agency') table = 'agency_reviews';
    else if (type === 'driver') table = 'driver_reviews';

    try {
        // 1. Rating Distribution
        const distQuery = `
            SELECT rating, COUNT(*) as count
            FROM ${table}
            GROUP BY rating
            ORDER BY rating DESC
        `;
        const distResult = await pool.query(distQuery);

        // 2. Rating Trend (Last 12 months)
        const trendQuery = `
            SELECT TO_CHAR(date, 'Mon YYYY') as month, AVG(rating) as avg_rating, COUNT(*) as count,
                   MIN(date) as sort_date
            FROM ${table}
            WHERE date >= NOW() - INTERVAL '12 months'
            GROUP BY month
            ORDER BY sort_date ASC
        `;
        const trendResult = await pool.query(trendQuery);

        res.json({
            distribution: distResult.rows,
            trend: trendResult.rows
        });
    } catch (error) {
        console.error('Error fetching review analytics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getAdminReviewStats,
    getAdminReviewsList,
    deleteAdminReview,
    getAdminReviewAnalytics
};
