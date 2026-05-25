const pool = require('../config/db');
const { generateAssignmentId } = require('./createIDs');

const getTripsStats = async (req, res) => {
    const { driverId } = req.params;
    try {
        const [countsRes, earningsRes, purposesRes] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE LOWER(status::text) = 'completed')::int AS completed,
                    COUNT(*) FILTER (WHERE LOWER(status::text) IN ('running', 'ongoing'))::int AS ongoing,
                    COUNT(*) FILTER (WHERE LOWER(status::text) = 'confirmed' AND start_ts > NOW())::int AS upcoming,
                    COUNT(*) FILTER (WHERE LOWER(status::text) = 'cancelled')::int AS cancelled
                FROM booking_info WHERE driver_id = $1
            `, [driverId]),
            pool.query(`
                SELECT
                    COALESCE(SUM(driver_cost) FILTER (WHERE LOWER(status::text) = 'completed'), 0)::bigint AS total_earned,
                    COALESCE(SUM(driver_cost) FILTER (WHERE LOWER(status::text) = 'completed'
                        AND DATE_TRUNC('month', end_ts) = DATE_TRUNC('month', CURRENT_DATE)), 0)::bigint AS earned_this_month,
                    COALESCE(SUM(driver_cost) FILTER (WHERE LOWER(status::text) = 'completed'
                        AND DATE_TRUNC('month', end_ts) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL'1 month')), 0)::bigint AS earned_last_month,
                    COUNT(*) FILTER (WHERE LOWER(status::text) = 'completed'
                        AND DATE_TRUNC('month', end_ts) = DATE_TRUNC('month', CURRENT_DATE))::int AS completed_this_month
                FROM booking_info WHERE driver_id = $1
            `, [driverId]),
            pool.query(`
                SELECT DISTINCT booking_purpose FROM booking_info
                WHERE driver_id = $1 AND booking_purpose IS NOT NULL ORDER BY booking_purpose
            `, [driverId]),
        ]);
        const c = countsRes.rows[0];
        const e = earningsRes.rows[0];
        res.json({
            total: c.total, completed: c.completed, ongoing: c.ongoing,
            upcoming: c.upcoming, cancelled: c.cancelled,
            totalEarned: parseInt(e.total_earned),
            earnedThisMonth: parseInt(e.earned_this_month),
            earnedLastMonth: parseInt(e.earned_last_month),
            completedThisMonth: c.completed_this_month,
            purposes: purposesRes.rows.map(r => r.booking_purpose),
        });
    } catch (err) {
        console.error('getTripsStats:', err);
        res.status(500).json({ error: err.message });
    }
};

const getTripsBanners = async (req, res) => {
    const { driverId } = req.params;
    try {
        const [activeRes, todayRes, tomorrowRes, missedRes, newRes, nextRes] = await Promise.all([
            pool.query(`
                SELECT bi.booking_id, bi.start_ts, u.name AS customer_name
                FROM booking_info bi JOIN users u ON bi.user_id = u.user_id
                WHERE bi.driver_id = $1 AND LOWER(bi.status::text) IN ('running', 'ongoing')
                ORDER BY bi.start_ts DESC LIMIT 1
            `, [driverId]),
            pool.query(`
                SELECT bi.booking_id, bi.start_ts, u.name AS customer_name
                FROM booking_info bi JOIN users u ON bi.user_id = u.user_id
                WHERE bi.driver_id = $1 AND LOWER(bi.status::text) = 'confirmed'
                AND DATE(bi.start_ts) = CURRENT_DATE AND bi.start_ts > NOW()
                ORDER BY bi.start_ts ASC LIMIT 1
            `, [driverId]),
            pool.query(`
                SELECT bi.booking_id, bi.start_ts
                FROM booking_info bi
                WHERE bi.driver_id = $1 AND LOWER(bi.status::text) = 'confirmed'
                AND DATE(bi.start_ts) = CURRENT_DATE + 1
                ORDER BY bi.start_ts ASC LIMIT 1
            `, [driverId]),
            pool.query(`
                SELECT bi.booking_id, bi.start_ts
                FROM booking_info bi
                LEFT JOIN pickup_info pi ON pi.booking_id = bi.booking_id
                WHERE bi.driver_id = $1 AND LOWER(bi.status::text) = 'confirmed'
                AND bi.start_ts < NOW() AND pi.pickup_id IS NULL LIMIT 1
            `, [driverId]),
            pool.query(`
                SELECT dta.assignment_id, bi.booking_id, bi.start_ts, dta.assigned_at
                FROM driver_trip_assignments dta
                JOIN booking_info bi ON bi.booking_id = dta.booking_id
                WHERE dta.driver_id = $1 AND dta.status = 'pending'
                AND dta.assigned_at > NOW() - INTERVAL '24 hours'
                ORDER BY dta.assigned_at DESC LIMIT 1
            `, [driverId]),
            pool.query(`
                SELECT bi.booking_id, bi.start_ts, bi.estimated_destination,
                       u.name AS customer_name,
                       COALESCE(c.brand, bk.brand) AS brand, COALESCE(c.model, bk.model) AS model
                FROM booking_info bi
                JOIN users u ON bi.user_id = u.user_id
                LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car'
                LEFT JOIN bikes bk ON bi.vehicle_id = bk.bike_id AND LOWER(bi.vehicle_type::text) = 'bike'
                WHERE bi.driver_id = $1 AND LOWER(bi.status::text) = 'confirmed' AND bi.start_ts > NOW()
                ORDER BY bi.start_ts ASC LIMIT 1
            `, [driverId]),
        ]);
        res.json({
            activeTrip: activeRes.rows[0] || null,
            upcomingToday: todayRes.rows[0] || null,
            upcomingTomorrow: tomorrowRes.rows[0] || null,
            missedPickup: missedRes.rows[0] || null,
            newAssignment: newRes.rows[0] || null,
            nextTrip: nextRes.rows[0] || null,
        });
    } catch (err) {
        console.error('getTripsBanners:', err);
        res.status(500).json({ error: err.message });
    }
};

const getTripsList = async (req, res) => {
    const { driverId } = req.params;
    const { page = 1, limit = 10, status, vehicleType, purpose, search,
            startDate, endDate, sort = 'newest', earningsRange, quickFilter } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [driverId];
    let idx = 2;
    const conds = [];

    const effectiveStatus = (quickFilter && !['all','thisweek','thismonth','lastmonth','highearnings','longtrips','selfdriv'].includes(quickFilter))
        ? quickFilter : status;

    if (effectiveStatus && effectiveStatus !== 'all') {
        const s = effectiveStatus.toLowerCase();
        if (s === 'ongoing') conds.push(`LOWER(bi.status::text) IN ('running', 'ongoing')`);
        else if (s === 'upcoming') conds.push(`LOWER(bi.status::text) = 'confirmed' AND bi.start_ts > NOW()`);
        else if (s === 'completed') conds.push(`LOWER(bi.status::text) = 'completed'`);
        else if (s === 'cancelled') conds.push(`LOWER(bi.status::text) = 'cancelled'`);
        else if (s === 'pending') conds.push(`LOWER(bi.status::text) IN ('requested', 'pending')`);
        else if (s === 'confirmed') conds.push(`LOWER(bi.status::text) = 'confirmed'`);
    }
    if (quickFilter === 'thisweek') conds.push(`bi.start_ts >= DATE_TRUNC('week', CURRENT_DATE) AND bi.start_ts < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'`);
    if (quickFilter === 'thismonth') conds.push(`DATE_TRUNC('month', bi.start_ts) = DATE_TRUNC('month', CURRENT_DATE)`);
    if (quickFilter === 'lastmonth') conds.push(`DATE_TRUNC('month', bi.start_ts) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`);
    if (quickFilter === 'highearnings') conds.push(`bi.driver_cost > 2000`);
    if (quickFilter === 'longtrips') conds.push(`bi.total_rent_hours > 24`);

    if (vehicleType && vehicleType !== 'all') {
        params.push(vehicleType.toLowerCase()); conds.push(`LOWER(bi.vehicle_type::text) = $${idx++}`);
    }
    if (purpose && purpose !== 'all') {
        params.push(purpose); conds.push(`bi.booking_purpose ILIKE $${idx++}`);
    }
    if (startDate) { params.push(startDate); conds.push(`DATE(bi.start_ts) >= $${idx++}`); }
    if (endDate)   { params.push(endDate);   conds.push(`DATE(bi.start_ts) <= $${idx++}`); }

    if (earningsRange && earningsRange !== 'all') {
        if (earningsRange === 'none')        conds.push(`(bi.driver_cost IS NULL OR bi.driver_cost = 0)`);
        if (earningsRange === 'under500')    conds.push(`bi.driver_cost < 500 AND bi.driver_cost > 0`);
        if (earningsRange === '500to2000')   conds.push(`bi.driver_cost BETWEEN 500 AND 2000`);
        if (earningsRange === '2000to5000')  conds.push(`bi.driver_cost BETWEEN 2000 AND 5000`);
        if (earningsRange === 'above5000')   conds.push(`bi.driver_cost > 5000`);
    }
    if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        conds.push(`(bi.booking_id ILIKE $${idx} OR u.name ILIKE $${idx} OR COALESCE(c.brand,bk.brand) ILIKE $${idx} OR COALESCE(c.model,bk.model) ILIKE $${idx} OR bi.estimated_destination ILIKE $${idx})`);
        idx++;
    }
    const where = conds.length > 0 ? `AND ${conds.join(' AND ')}` : '';

    const pin = `CASE WHEN LOWER(bi.status::text) IN ('running','ongoing') THEN 0 ELSE 1 END`;
    const orderBy = sort === 'oldest'      ? `${pin}, bi.booking_ts ASC`
                  : sort === 'startasc'    ? `${pin}, bi.start_ts ASC`
                  : sort === 'startdesc'   ? `${pin}, bi.start_ts DESC`
                  : sort === 'highearnings'? `${pin}, bi.driver_cost DESC NULLS LAST`
                  : sort === 'lowearnings' ? `${pin}, bi.driver_cost ASC NULLS LAST`
                  : `${pin}, bi.booking_ts DESC`;

    const joins = `
        FROM booking_info bi
        JOIN users u ON bi.user_id = u.user_id
        LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car'
        LEFT JOIN bikes bk ON bi.vehicle_id = bk.bike_id AND LOWER(bi.vehicle_type::text) = 'bike'
        WHERE bi.driver_id = $1 ${where}
    `;
    try {
        const [listRes, cntRes] = await Promise.all([
            pool.query(`
                SELECT bi.booking_id, bi.vehicle_type, bi.vehicle_id, bi.start_ts, bi.end_ts, bi.booking_ts,
                       bi.total_rent_hours, bi.driver_cost, bi.total_cost, bi.initial_payment, bi.final_payment,
                       bi.status, bi.booking_purpose, bi.estimated_destination,
                       bi.cancelled_by, bi.cancel_reason, bi.cancelled_at,
                       u.name AS customer_name, u.phone AS customer_phone,
                       COALESCE(c.brand,bk.brand) AS brand, COALESCE(c.model,bk.model) AS model,
                       COALESCE(c.car_type,bk.car_type) AS car_type,
                       COALESCE(c.images[1],bk.images[1]) AS vehicle_image
                ${joins} ORDER BY ${orderBy}
                LIMIT $${idx} OFFSET $${idx+1}
            `, [...params, parseInt(limit), offset]),
            pool.query(`
                SELECT COUNT(*)::int AS total,
                       COALESCE(SUM(bi.driver_cost) FILTER (WHERE LOWER(bi.status::text)='completed'),0)::bigint AS filtered_earnings
                ${joins}
            `, params),
        ]);
        res.json({
            trips: listRes.rows,
            total: cntRes.rows[0].total,
            filteredEarnings: parseInt(cntRes.rows[0].filtered_earnings),
            page: parseInt(page),
            totalPages: Math.ceil(cntRes.rows[0].total / parseInt(limit)),
        });
    } catch (err) {
        console.error('getTripsList:', err);
        res.status(500).json({ error: err.message });
    }
};

const getTripDetail = async (req, res) => {
    const { bookingId } = req.params;
    try {
        const [bkRes, pickRes, retRes, revRes, payRes] = await Promise.all([
            pool.query(`
                SELECT bi.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
                    COALESCE(c.brand,bk.brand) AS brand, COALESCE(c.model,bk.model) AS model,
                    COALESCE(c.car_type,bk.car_type) AS car_type,
                    COALESCE(c.images,bk.images) AS vehicle_images,
                    COALESCE(c.rental_price,bk.rental_price) AS vehicle_rental_price,
                    c.transmission_type, COALESCE(c.fuel,bk.fuel) AS fuel,
                    c.seats, bk.engine_capacity, COALESCE(c.gear,bk.gear) AS gear
                FROM booking_info bi
                JOIN users u ON bi.user_id = u.user_id
                LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car'
                LEFT JOIN bikes bk ON bi.vehicle_id = bk.bike_id AND LOWER(bi.vehicle_type::text) = 'bike'
                WHERE bi.booking_id = $1
            `, [bookingId]),
            pool.query(`SELECT * FROM pickup_info WHERE booking_id = $1`, [bookingId]),
            pool.query(`SELECT * FROM return_info WHERE booking_id = $1`, [bookingId]),
            pool.query(`
                SELECT dr.*, u.name AS reviewer_name
                FROM driver_reviews dr LEFT JOIN users u ON dr.user_id = u.user_id
                WHERE dr.driver_id = (SELECT driver_id FROM booking_info WHERE booking_id = $1)
                AND dr.date BETWEEN (SELECT start_ts FROM booking_info WHERE booking_id = $1) - INTERVAL '1 day'
                               AND (SELECT COALESCE(end_ts, NOW()) FROM booking_info WHERE booking_id = $1) + INTERVAL '7 days'
                ORDER BY dr.date DESC LIMIT 1
            `, [bookingId]),
            pool.query(`SELECT * FROM payment_info WHERE booking_id = $1 ORDER BY date DESC`, [bookingId]),
        ]);
        const bk = bkRes.rows[0];
        if (!bk) return res.status(404).json({ error: 'Booking not found' });
        res.json({ ...bk, pickup: pickRes.rows[0] || null, return: retRes.rows[0] || null, review: revRes.rows[0] || null, payments: payRes.rows });
    } catch (err) {
        console.error('getTripDetail:', err);
        res.status(500).json({ error: err.message });
    }
};

const getTripEarnings = async (req, res) => {
    const { driverId } = req.params;
    try {
        const [chartRes, topRes, lifetimeRes] = await Promise.all([
            pool.query(`
                WITH months AS (SELECT generate_series(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'), DATE_TRUNC('month', CURRENT_DATE), '1 month') AS month)
                SELECT TO_CHAR(m.month, 'Mon ''YY') AS label, m.month,
                       COALESCE(SUM(bi.driver_cost), 0)::bigint AS earned, COUNT(bi.booking_id)::int AS trips
                FROM months m
                LEFT JOIN booking_info bi ON DATE_TRUNC('month', bi.end_ts) = m.month
                    AND bi.driver_id = $1 AND LOWER(bi.status::text) = 'completed'
                GROUP BY m.month ORDER BY m.month
            `, [driverId]),
            pool.query(`
                SELECT bi.booking_id, bi.start_ts, bi.driver_cost, u.name AS customer_name,
                       COALESCE(c.brand,bk.brand) AS brand, COALESCE(c.model,bk.model) AS model
                FROM booking_info bi JOIN users u ON bi.user_id = u.user_id
                LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car'
                LEFT JOIN bikes bk ON bi.vehicle_id = bk.bike_id AND LOWER(bi.vehicle_type::text) = 'bike'
                WHERE bi.driver_id = $1 AND LOWER(bi.status::text) = 'completed' AND bi.driver_cost > 0
                ORDER BY bi.driver_cost DESC LIMIT 3
            `, [driverId]),
            pool.query(`
                SELECT COALESCE(SUM(driver_cost), 0)::bigint AS all_time,
                    COALESCE(SUM(driver_cost) FILTER (WHERE DATE_TRUNC('month',end_ts)=DATE_TRUNC('month',CURRENT_DATE)), 0)::bigint AS this_month,
                    COALESCE(SUM(driver_cost) FILTER (WHERE DATE_TRUNC('month',end_ts)=DATE_TRUNC('month',CURRENT_DATE-INTERVAL'1 month')), 0)::bigint AS last_month,
                    COALESCE(SUM(driver_cost) FILTER (WHERE end_ts >= DATE_TRUNC('week', CURRENT_DATE)), 0)::bigint AS this_week,
                    COALESCE(AVG(driver_cost), 0)::bigint AS avg_per_trip,
                    COUNT(*)::int AS completed_count
                FROM booking_info WHERE driver_id = $1 AND LOWER(status::text) = 'completed'
            `, [driverId]),
        ]);
        res.json({
            chart: chartRes.rows,
            top3: topRes.rows,
            lifetime: lifetimeRes.rows[0],
        });
    } catch (err) {
        console.error('getTripEarnings:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get all pending trip requests for a driver
const getDriverRequests = async (req, res) => {
    const { driverId } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                dta.assignment_id, dta.status AS assignment_status, dta.assigned_at,
                bi.booking_id, bi.start_ts, bi.end_ts, bi.total_rent_hours, bi.driver_cost,
                bi.total_cost, bi.booking_purpose, bi.estimated_destination, bi.vehicle_type,
                u.name AS customer_name, u.phone AS customer_phone,
                COALESCE(c.brand, bk.brand) AS brand,
                COALESCE(c.model, bk.model) AS model,
                COALESCE(c.car_type, bk.car_type) AS car_type,
                COALESCE(c.images[1], bk.images[1]) AS vehicle_image,
                ag.agency_name
            FROM driver_trip_assignments dta
            JOIN booking_info bi ON bi.booking_id = dta.booking_id
            JOIN users u ON u.user_id = bi.user_id
            LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car'
            LEFT JOIN bikes bk ON bi.vehicle_id = bk.bike_id AND LOWER(bi.vehicle_type::text) = 'bike'
            LEFT JOIN agency_info ag ON ag.agency_id = bi.agency_id
            WHERE dta.driver_id = $1 AND dta.status = 'pending'
            ORDER BY dta.assigned_at DESC
        `, [driverId]);
        res.json(result.rows);
    } catch (err) {
        console.error('getDriverRequests:', err);
        res.status(500).json({ error: err.message });
    }
};

// Accept or reject a trip request
const respondToRequest = async (req, res) => {
    const { assignmentId } = req.params;
    const { action, driver_note } = req.body; // action: 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'action must be accept or reject' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch the assignment with a row lock
        const asgRes = await client.query(
            `SELECT dta.*, bi.vehicle_id, bi.vehicle_type
             FROM driver_trip_assignments dta
             JOIN booking_info bi ON bi.booking_id = dta.booking_id
             WHERE dta.assignment_id = $1 FOR UPDATE`,
            [assignmentId]
        );
        if (!asgRes.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Assignment not found' });
        }
        const asgn = asgRes.rows[0];
        if (asgn.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Assignment already responded to' });
        }

        if (action === 'accept') {
            // Set driver_id in booking_info
            await client.query(
                `UPDATE booking_info SET driver_id = $1 WHERE booking_id = $2`,
                [asgn.driver_id, asgn.booking_id]
            );
            // Mark driver unavailable
            await client.query(
                `UPDATE driver_info SET availability = false WHERE driver_id = $1`,
                [asgn.driver_id]
            );
            // Update assignment
            await client.query(
                `UPDATE driver_trip_assignments
                 SET status = 'confirmed', responded_at = NOW(), driver_note = $1
                 WHERE assignment_id = $2`,
                [driver_note || null, assignmentId]
            );
        } else {
            // Reject: just update the assignment, driver_id stays NULL
            await client.query(
                `UPDATE driver_trip_assignments
                 SET status = 'cancelled_by_driver', responded_at = NOW(), driver_note = $1
                 WHERE assignment_id = $2`,
                [driver_note || null, assignmentId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, action });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('respondToRequest:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

module.exports = { getTripsStats, getTripsBanners, getTripsList, getTripDetail, getTripEarnings, getDriverRequests, respondToRequest };
