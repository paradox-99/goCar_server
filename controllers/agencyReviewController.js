const pool = require('../config/db');

const buildRatingCondition = (quickFilter, alias) => {
    if (!quickFilter || quickFilter === 'all') return null;
    if (quickFilter === '5') return `${alias}.rating = 5`;
    if (quickFilter === '4') return `${alias}.rating >= 4 AND ${alias}.rating < 5`;
    if (quickFilter === '3') return `${alias}.rating >= 3 AND ${alias}.rating < 4`;
    if (quickFilter === '2') return `${alias}.rating >= 2 AND ${alias}.rating < 3`;
    if (quickFilter === '1') return `${alias}.rating >= 1 AND ${alias}.rating < 2`;
    if (quickFilter === 'critical') return `${alias}.rating <= 2`;
    if (quickFilter === 'week') return `${alias}.date >= NOW() - INTERVAL '7 days'`;
    if (quickFilter === 'month') return `${alias}.date >= NOW() - INTERVAL '30 days'`;
    if (quickFilter === 'notext') return `(${alias}.review IS NULL OR ${alias}.review = '')`;
    return null;
};

const buildRatingFilter = (ratingFilter, alias) => {
    if (!ratingFilter || ratingFilter === 'all') return null;
    if (ratingFilter === '5only') return `${alias}.rating = 5`;
    if (ratingFilter === '4plus') return `${alias}.rating >= 4`;
    if (ratingFilter === '3plus') return `${alias}.rating >= 3`;
    if (ratingFilter === 'below3') return `${alias}.rating < 3`;
    if (ratingFilter === 'critical') return `${alias}.rating <= 2`;
    return null;
};

const getAgencyReviewStats = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const statsQuery = `
            SELECT
                (SELECT COUNT(*) FROM cars_reviews cr JOIN cars c ON cr.car_id = c.car_id WHERE c.agency_id = $1)::int AS car_review_count,
                (SELECT COUNT(*) FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id = b.bike_id WHERE b.agency_id = $1)::int AS bike_review_count,
                (SELECT AVG(cr.rating) FROM cars_reviews cr JOIN cars c ON cr.car_id = c.car_id WHERE c.agency_id = $1) AS avg_car_rating,
                (SELECT AVG(mr.rating) FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id = b.bike_id WHERE b.agency_id = $1) AS avg_bike_rating,
                (SELECT COUNT(*) FROM agency_reviews WHERE agency_id = $1)::int AS agency_review_count,
                (SELECT AVG(rating) FROM agency_reviews WHERE agency_id = $1) AS avg_agency_rating,
                (SELECT COUNT(*) FROM driver_reviews dr JOIN driver_info di ON dr.driver_id = di.driver_id WHERE di.agency_id = $1)::int AS driver_review_count,
                (SELECT AVG(dr.rating) FROM driver_reviews dr JOIN driver_info di ON dr.driver_id = di.driver_id WHERE di.agency_id = $1) AS avg_driver_rating,
                (
                    (SELECT COUNT(*) FROM cars_reviews cr JOIN cars c ON cr.car_id = c.car_id WHERE c.agency_id = $1 AND cr.rating <= 2) +
                    (SELECT COUNT(*) FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id = b.bike_id WHERE b.agency_id = $1 AND mr.rating <= 2) +
                    (SELECT COUNT(*) FROM agency_reviews WHERE agency_id = $1 AND rating <= 2) +
                    (SELECT COUNT(*) FROM driver_reviews dr JOIN driver_info di ON dr.driver_id = di.driver_id WHERE di.agency_id = $1 AND dr.rating <= 2)
                )::int AS critical_count,
                (
                    SELECT COUNT(*) FROM (
                        SELECT c.car_id FROM cars c
                        LEFT JOIN cars_reviews cr ON c.car_id = cr.car_id
                        WHERE c.agency_id = $1
                        GROUP BY c.car_id HAVING COUNT(cr.car_id) = 0
                        UNION ALL
                        SELECT b.bike_id FROM bikes b
                        LEFT JOIN motorbike_reviews mr ON b.bike_id = mr.bike_id
                        WHERE b.agency_id = $1
                        GROUP BY b.bike_id HAVING COUNT(mr.bike_id) = 0
                    ) AS unrev
                )::int AS unreviewed_vehicles,
                (SELECT AVG(rating) FROM agency_reviews WHERE agency_id = $1 AND date >= NOW() - INTERVAL '30 days') AS current_month_agency_rating,
                (SELECT AVG(rating) FROM agency_reviews WHERE agency_id = $1 AND date >= NOW() - INTERVAL '60 days' AND date < NOW() - INTERVAL '30 days') AS last_month_agency_rating
        `;

        const result = await pool.query(statsQuery, [agencyId]);
        const s = result.rows[0];

        const carCount = parseInt(s.car_review_count) || 0;
        const bikeCount = parseInt(s.bike_review_count) || 0;
        const vehicleCount = carCount + bikeCount;
        const agencyCount = parseInt(s.agency_review_count) || 0;
        const driverCount = parseInt(s.driver_review_count) || 0;
        const totalCount = vehicleCount + agencyCount + driverCount;

        const avgCar = parseFloat(s.avg_car_rating) || 0;
        const avgBike = parseFloat(s.avg_bike_rating) || 0;
        const avgAgency = parseFloat(s.avg_agency_rating) || 0;
        const avgDriver = parseFloat(s.avg_driver_rating) || 0;

        let overallRating = 0;
        if (totalCount > 0) {
            overallRating = (avgCar * carCount + avgBike * bikeCount + avgAgency * agencyCount + avgDriver * driverCount) / totalCount;
        }

        const currentMonthRating = parseFloat(s.current_month_agency_rating);
        const lastMonthRating = parseFloat(s.last_month_agency_rating);
        const ratingTrend = (!isNaN(currentMonthRating) && !isNaN(lastMonthRating))
            ? parseFloat((currentMonthRating - lastMonthRating).toFixed(2))
            : null;

        res.json({
            overallRating: parseFloat(overallRating.toFixed(2)),
            vehicleReviewCount: vehicleCount,
            agencyReviewCount: agencyCount,
            driverReviewCount: driverCount,
            totalReviewCount: totalCount,
            avgAgencyRating: parseFloat(avgAgency.toFixed(2)),
            criticalCount: parseInt(s.critical_count) || 0,
            unreviewedVehicles: parseInt(s.unreviewed_vehicles) || 0,
            ratingTrend
        });
    } catch (error) {
        console.error('Error fetching agency review stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAgencyVehicleReviews = async (req, res) => {
    const { agencyId } = req.params;
    const {
        page = 1, limit = 10, search = '', quickFilter = 'all', ratingFilter = 'all',
        start, end, sortBy = 'newest', vehicleType = 'all', vehicleId
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const values = [agencyId];
        const carConds = [`c.agency_id = $1`];
        const bikeConds = [`b.agency_id = $1`];

        if (search) {
            values.push(`%${search}%`);
            const idx = values.length;
            carConds.push(`(c.brand ILIKE $${idx} OR c.model ILIKE $${idx} OR u.name ILIKE $${idx} OR cr.review ILIKE $${idx})`);
            bikeConds.push(`(b.brand ILIKE $${idx} OR b.model ILIKE $${idx} OR u.name ILIKE $${idx} OR mr.review ILIKE $${idx})`);
        }

        if (vehicleId && vehicleType === 'car') {
            values.push(vehicleId);
            carConds.push(`cr.car_id = $${values.length}`);
        }
        if (vehicleId && vehicleType === 'bike') {
            values.push(vehicleId);
            bikeConds.push(`mr.bike_id = $${values.length}`);
        }

        const qfCar = buildRatingCondition(quickFilter, 'cr');
        const qfBike = buildRatingCondition(quickFilter, 'mr');
        if (qfCar) carConds.push(qfCar);
        if (qfBike) bikeConds.push(qfBike);

        const rfCar = buildRatingFilter(ratingFilter, 'cr');
        const rfBike = buildRatingFilter(ratingFilter, 'mr');
        if (rfCar) carConds.push(rfCar);
        if (rfBike) bikeConds.push(rfBike);

        if (start) { values.push(start); carConds.push(`cr.date >= $${values.length}`); bikeConds.push(`mr.date >= $${values.length}`); }
        if (end) { values.push(end); carConds.push(`cr.date <= $${values.length}`); bikeConds.push(`mr.date <= $${values.length}`); }

        let orderClause = 'date DESC';
        if (sortBy === 'oldest') orderClause = 'date ASC';
        else if (sortBy === 'highest') orderClause = 'rating DESC';
        else if (sortBy === 'lowest') orderClause = 'rating ASC';

        const carSubQ = `
            SELECT cr.car_id AS entity_id, cr.user_id, cr.date, cr.review, cr.rating,
                   u.name AS reviewer_name, u.phone AS reviewer_phone, u.photo AS reviewer_photo,
                   c.brand, c.model, c.car_type AS vehicle_sub_type, c.images,
                   'car' AS vehicle_type, c.car_id AS vehicle_id
            FROM cars_reviews cr
            JOIN users u ON cr.user_id = u.user_id
            JOIN cars c ON cr.car_id = c.car_id
            WHERE ${carConds.join(' AND ')}
        `;

        const bikeSubQ = `
            SELECT mr.bike_id AS entity_id, mr.user_id, mr.date, mr.review, mr.rating,
                   u.name AS reviewer_name, u.phone AS reviewer_phone, u.photo AS reviewer_photo,
                   b.brand, b.model, b.car_type AS vehicle_sub_type, b.images,
                   'bike' AS vehicle_type, b.bike_id AS vehicle_id
            FROM motorbike_reviews mr
            JOIN users u ON mr.user_id = u.user_id
            JOIN bikes b ON mr.bike_id = b.bike_id
            WHERE ${bikeConds.join(' AND ')}
        `;

        let baseQ = '';
        if (vehicleType === 'car') baseQ = carSubQ;
        else if (vehicleType === 'bike') baseQ = bikeSubQ;
        else baseQ = `${carSubQ} UNION ALL ${bikeSubQ}`;

        const [countRes, dataRes, avgRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM (${baseQ}) AS c`, values),
            pool.query(`SELECT * FROM (${baseQ}) AS c ORDER BY ${orderClause} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, parseInt(limit), offset]),
            pool.query(`SELECT AVG(rating) AS avg_rating FROM (${baseQ}) AS c`, values)
        ]);

        res.json({
            reviews: dataRes.rows,
            total: parseInt(countRes.rows[0].count),
            avgRating: parseFloat(avgRes.rows[0].avg_rating) || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching agency vehicle reviews:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAgencyVehicleSummary = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const carQ = `
            SELECT c.car_id AS vehicle_id, c.brand, c.model, c.car_type, c.images, 'car' AS vehicle_type,
                   COALESCE(AVG(cr.rating), 0) AS avg_rating,
                   COUNT(cr.car_id) AS review_count,
                   COUNT(CASE WHEN cr.rating = 5 THEN 1 END) AS star5,
                   COUNT(CASE WHEN cr.rating >= 4 AND cr.rating < 5 THEN 1 END) AS star4,
                   COUNT(CASE WHEN cr.rating >= 3 AND cr.rating < 4 THEN 1 END) AS star3,
                   COUNT(CASE WHEN cr.rating >= 2 AND cr.rating < 3 THEN 1 END) AS star2,
                   COUNT(CASE WHEN cr.rating < 2 THEN 1 END) AS star1
            FROM cars c
            LEFT JOIN cars_reviews cr ON c.car_id = cr.car_id
            WHERE c.agency_id = $1
            GROUP BY c.car_id, c.brand, c.model, c.car_type, c.images
            ORDER BY avg_rating DESC
        `;
        const bikeQ = `
            SELECT b.bike_id AS vehicle_id, b.brand, b.model, b.car_type, b.images, 'bike' AS vehicle_type,
                   COALESCE(AVG(mr.rating), 0) AS avg_rating,
                   COUNT(mr.bike_id) AS review_count,
                   COUNT(CASE WHEN mr.rating = 5 THEN 1 END) AS star5,
                   COUNT(CASE WHEN mr.rating >= 4 AND mr.rating < 5 THEN 1 END) AS star4,
                   COUNT(CASE WHEN mr.rating >= 3 AND mr.rating < 4 THEN 1 END) AS star3,
                   COUNT(CASE WHEN mr.rating >= 2 AND mr.rating < 3 THEN 1 END) AS star2,
                   COUNT(CASE WHEN mr.rating < 2 THEN 1 END) AS star1
            FROM bikes b
            LEFT JOIN motorbike_reviews mr ON b.bike_id = mr.bike_id
            WHERE b.agency_id = $1
            GROUP BY b.bike_id, b.brand, b.model, b.car_type, b.images
            ORDER BY avg_rating DESC
        `;

        const [carRes, bikeRes] = await Promise.all([
            pool.query(carQ, [agencyId]),
            pool.query(bikeQ, [agencyId])
        ]);

        res.json({ cars: carRes.rows, bikes: bikeRes.rows });
    } catch (error) {
        console.error('Error fetching vehicle summary:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAgencyReviews = async (req, res) => {
    const { agencyId } = req.params;
    const {
        page = 1, limit = 10, search = '', quickFilter = 'all', ratingFilter = 'all',
        start, end, sortBy = 'newest'
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const values = [agencyId];
        const conds = [`ar.agency_id = $1`];

        if (search) {
            values.push(`%${search}%`);
            conds.push(`(u.name ILIKE $${values.length} OR ar.review ILIKE $${values.length})`);
        }

        const qf = buildRatingCondition(quickFilter, 'ar');
        if (qf) conds.push(qf);
        const rf = buildRatingFilter(ratingFilter, 'ar');
        if (rf) conds.push(rf);

        if (start) { values.push(start); conds.push(`ar.date >= $${values.length}`); }
        if (end) { values.push(end); conds.push(`ar.date <= $${values.length}`); }

        let orderClause = 'ar.date DESC';
        if (sortBy === 'oldest') orderClause = 'ar.date ASC';
        else if (sortBy === 'highest') orderClause = 'ar.rating DESC';
        else if (sortBy === 'lowest') orderClause = 'ar.rating ASC';

        const where = conds.join(' AND ');
        const baseQ = `
            SELECT ar.*, u.name AS reviewer_name, u.phone AS reviewer_phone, u.photo AS reviewer_photo,
                   a.agency_name
            FROM agency_reviews ar
            JOIN users u ON ar.user_id = u.user_id
            JOIN agencies a ON ar.agency_id = a.agency_id
            WHERE ${where}
        `;

        const [countRes, dataRes, avgRes, breakdownRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM agency_reviews ar JOIN users u ON ar.user_id = u.user_id WHERE ${where}`, values),
            pool.query(`${baseQ} ORDER BY ${orderClause} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, parseInt(limit), offset]),
            pool.query(`SELECT AVG(rating) AS avg_rating FROM agency_reviews WHERE agency_id = $1`, [agencyId]),
            pool.query(`
                SELECT FLOOR(rating)::int AS star, COUNT(*) AS count
                FROM agency_reviews WHERE agency_id = $1
                GROUP BY FLOOR(rating)::int ORDER BY star DESC
            `, [agencyId])
        ]);

        res.json({
            reviews: dataRes.rows,
            total: parseInt(countRes.rows[0].count),
            avgRating: parseFloat(avgRes.rows[0].avg_rating) || 0,
            ratingBreakdown: breakdownRes.rows,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching agency reviews:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAgencyDriverReviews = async (req, res) => {
    const { agencyId } = req.params;
    const {
        page = 1, limit = 10, search = '', quickFilter = 'all', ratingFilter = 'all',
        start, end, sortBy = 'newest', driverId
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const values = [agencyId];
        const conds = [`di.agency_id = $1`];

        if (search) {
            values.push(`%${search}%`);
            conds.push(`(u.name ILIKE $${values.length} OR di.name ILIKE $${values.length} OR dr.review ILIKE $${values.length})`);
        }

        if (driverId) { values.push(driverId); conds.push(`dr.driver_id = $${values.length}`); }

        const qf = buildRatingCondition(quickFilter, 'dr');
        if (qf) conds.push(qf);
        const rf = buildRatingFilter(ratingFilter, 'dr');
        if (rf) conds.push(rf);

        if (start) { values.push(start); conds.push(`dr.date >= $${values.length}`); }
        if (end) { values.push(end); conds.push(`dr.date <= $${values.length}`); }

        let orderClause = 'dr.date DESC';
        if (sortBy === 'oldest') orderClause = 'dr.date ASC';
        else if (sortBy === 'highest') orderClause = 'dr.rating DESC';
        else if (sortBy === 'lowest') orderClause = 'dr.rating ASC';

        const where = conds.join(' AND ');
        const baseQ = `
            SELECT dr.*, u.name AS reviewer_name, u.phone AS reviewer_phone, u.photo AS reviewer_photo,
                   di.name AS driver_name, di.photo AS driver_photo, di.availability, di.driver_id AS driver_ref_id,
                   di.rating AS driver_overall_rating
            FROM driver_reviews dr
            JOIN users u ON dr.user_id = u.user_id
            JOIN driver_info di ON dr.driver_id = di.driver_id
            WHERE ${where}
        `;

        const [countRes, dataRes, avgRes] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM driver_reviews dr JOIN users u ON dr.user_id = u.user_id JOIN driver_info di ON dr.driver_id = di.driver_id WHERE ${where}`, values),
            pool.query(`${baseQ} ORDER BY ${orderClause} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, parseInt(limit), offset]),
            pool.query(`SELECT AVG(dr.rating) AS avg_rating FROM driver_reviews dr JOIN driver_info di ON dr.driver_id = di.driver_id WHERE di.agency_id = $1`, [agencyId])
        ]);

        res.json({
            reviews: dataRes.rows,
            total: parseInt(countRes.rows[0].count),
            avgRating: parseFloat(avgRes.rows[0].avg_rating) || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching agency driver reviews:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getAgencyDriverSummary = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const query = `
            SELECT di.driver_id, di.name AS driver_name, di.photo AS driver_photo, di.availability,
                   COALESCE(AVG(dr.rating), 0) AS avg_rating,
                   COUNT(dr.driver_id) AS review_count,
                   COUNT(CASE WHEN dr.rating = 5 THEN 1 END) AS star5,
                   COUNT(CASE WHEN dr.rating >= 4 AND dr.rating < 5 THEN 1 END) AS star4,
                   COUNT(CASE WHEN dr.rating >= 3 AND dr.rating < 4 THEN 1 END) AS star3,
                   COUNT(CASE WHEN dr.rating >= 2 AND dr.rating < 3 THEN 1 END) AS star2,
                   COUNT(CASE WHEN dr.rating < 2 THEN 1 END) AS star1
            FROM driver_info di
            LEFT JOIN driver_reviews dr ON di.driver_id = dr.driver_id
            WHERE di.agency_id = $1
            GROUP BY di.driver_id, di.name, di.photo, di.availability
            ORDER BY avg_rating DESC
        `;
        const result = await pool.query(query, [agencyId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching driver summary:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getAgencyReviewStats,
    getAgencyVehicleReviews,
    getAgencyVehicleSummary,
    getAgencyReviews,
    getAgencyDriverReviews,
    getAgencyDriverSummary
};
