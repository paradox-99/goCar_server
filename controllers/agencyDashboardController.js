const pool = require('../config/db');

const IS_PAID_DR = `EXISTS (
    SELECT 1 FROM payment_info pi
    WHERE pi.booking_id = dr.booking_id
    AND (pi.payment_for ILIKE '%damage%' OR pi.payment_for ILIKE '%repair%')
)`;

const getAgencyDashboardStats = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const [agencyRes, bookingRes, fleetRes, driverRes, reviewRes, damageRes, docsRes, licensesRes, todayRes] = await Promise.all([
            pool.query(
                `SELECT agency_name, verified, expire_date, status FROM agencies WHERE agency_id = $1`,
                [agencyId]
            ),
            pool.query(`
                SELECT
                    COUNT(*)::int AS total_bookings,
                    COUNT(*) FILTER (WHERE bi.status IN ('Confirmed','Running'))::int AS active_bookings,
                    COUNT(*) FILTER (WHERE bi.status = 'Requested')::int AS pending_requests,
                    COUNT(*) FILTER (WHERE bi.status = 'Completed')::int AS completed_trips,
                    COUNT(*) FILTER (WHERE bi.status = 'Cancelled')::int AS cancelled_bookings,
                    COALESCE(SUM(bi.total_cost) FILTER (WHERE bi.status='Completed'), 0)::bigint AS total_revenue,
                    COALESCE(SUM(bi.total_cost) FILTER (WHERE bi.status='Completed' AND DATE_TRUNC('month',bi.booking_ts)=DATE_TRUNC('month',CURRENT_DATE)), 0)::bigint AS this_month_revenue,
                    COALESCE(SUM(bi.total_cost) FILTER (WHERE bi.status='Completed' AND DATE_TRUNC('month',bi.booking_ts)=DATE_TRUNC('month',CURRENT_DATE-INTERVAL'1 month')), 0)::bigint AS last_month_revenue,
                    COALESCE(SUM(bi.total_cost) FILTER (WHERE bi.status='Completed' AND bi.booking_ts>=CURRENT_DATE-INTERVAL'7 days'), 0)::bigint AS this_week_revenue,
                    COALESCE(SUM(bi.total_cost) FILTER (WHERE bi.status='Completed' AND bi.vehicle_type='Car'), 0)::bigint AS car_revenue,
                    COALESCE(SUM(bi.total_cost) FILTER (WHERE bi.status='Completed' AND bi.vehicle_type='Bike'), 0)::bigint AS bike_revenue,
                    COUNT(*) FILTER (WHERE bi.status='Completed' AND DATE_TRUNC('month',bi.booking_ts)=DATE_TRUNC('month',CURRENT_DATE))::int AS this_month_trips,
                    COUNT(*) FILTER (WHERE bi.status='Completed' AND DATE_TRUNC('month',bi.booking_ts)=DATE_TRUNC('month',CURRENT_DATE-INTERVAL'1 month'))::int AS last_month_trips
                FROM booking_info bi
                LEFT JOIN cars _vc ON bi.vehicle_id = _vc.car_id AND bi.vehicle_type = 'Car'
                LEFT JOIN bikes _vb ON bi.vehicle_id = _vb.bike_id AND bi.vehicle_type = 'Bike'
                WHERE COALESCE(bi.agency_id, _vc.agency_id, _vb.agency_id) = $1
            `, [agencyId]),
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1)::int AS car_count,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status='Available')::int AS cars_available,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status IN ('Booked','Requested'))::int AS cars_booked,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status='Maintenance')::int AS cars_maintenance,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status IN ('Unavailable','Suspend'))::int AS cars_inactive,
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1)::int AS bike_count,
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status='Available')::int AS bikes_available,
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status IN ('Booked','Requested'))::int AS bikes_booked,
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status='Maintenance')::int AS bikes_maintenance,
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status IN ('Unavailable','Suspend'))::int AS bikes_inactive
            `, [agencyId]),
            pool.query(`
                SELECT
                    COUNT(*)::int AS driver_count,
                    COUNT(*) FILTER (WHERE availability=true AND accountstatus='Active')::int AS drivers_available,
                    COUNT(*) FILTER (WHERE availability=false AND accountstatus!='Suspended')::int AS drivers_unavailable,
                    COUNT(*) FILTER (WHERE accountstatus='Suspended')::int AS drivers_suspended
                FROM driver_info WHERE agency_id=$1
            `, [agencyId]),
            pool.query(`
                SELECT
                    COALESCE((SELECT AVG(rating) FROM agency_reviews WHERE agency_id=$1),0) AS agency_avg,
                    (SELECT COUNT(*) FROM agency_reviews WHERE agency_id=$1)::int AS agency_count,
                    COALESCE((SELECT AVG(cr.rating) FROM cars_reviews cr JOIN cars c ON cr.car_id=c.car_id WHERE c.agency_id=$1),0) AS car_avg,
                    (SELECT COUNT(*) FROM cars_reviews cr JOIN cars c ON cr.car_id=c.car_id WHERE c.agency_id=$1)::int AS car_count,
                    COALESCE((SELECT AVG(mr.rating) FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id=b.bike_id WHERE b.agency_id=$1),0) AS bike_avg,
                    (SELECT COUNT(*) FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id=b.bike_id WHERE b.agency_id=$1)::int AS bike_count,
                    COALESCE((SELECT AVG(dr.rating) FROM driver_reviews dr JOIN driver_info di ON dr.driver_id=di.driver_id WHERE di.agency_id=$1),0) AS driver_avg,
                    (SELECT COUNT(*) FROM driver_reviews dr JOIN driver_info di ON dr.driver_id=di.driver_id WHERE di.agency_id=$1)::int AS driver_count,
                    (SELECT AVG(rating) FROM agency_reviews WHERE agency_id=$1 AND date>=CURRENT_DATE-INTERVAL'30 days') AS current_month_rating,
                    (SELECT AVG(rating) FROM agency_reviews WHERE agency_id=$1 AND date>=CURRENT_DATE-INTERVAL'60 days' AND date<CURRENT_DATE-INTERVAL'30 days') AS last_month_rating
            `, [agencyId]),
            pool.query(`
                SELECT
                    COUNT(*) FILTER (WHERE dr.severity='High' AND dr.status='Pending')::int AS severe_open,
                    COUNT(*) FILTER (WHERE dr.estimated_cost>0 AND NOT ${IS_PAID_DR})::int AS unpaid_charges,
                    COALESCE((SELECT SUM(pi.amount) FROM payment_info pi
                        JOIN damage_reports dr2 ON pi.booking_id=dr2.booking_id
                        LEFT JOIN cars c2 ON dr2.car_id=c2.car_id
                        LEFT JOIN bikes b2 ON dr2.bike_id=b2.bike_id
                        WHERE COALESCE(c2.agency_id, b2.agency_id)=$1
                        AND (pi.payment_for ILIKE '%damage%' OR pi.payment_for ILIKE '%repair%')), 0) AS damage_recovered,
                    COALESCE(SUM(CASE WHEN NOT ${IS_PAID_DR} AND dr.estimated_cost>0 THEN dr.estimated_cost END), 0) AS damage_outstanding
                FROM damage_reports dr
                LEFT JOIN cars c ON dr.car_id=c.car_id
                LEFT JOIN bikes b ON dr.bike_id=b.bike_id
                WHERE COALESCE(c.agency_id, b.agency_id)=$1
            `, [agencyId]),
            pool.query(`
                SELECT (
                    (SELECT COUNT(*) FROM cars_documentation cd JOIN cars c ON cd.car_id=c.car_id
                        WHERE c.agency_id=$1 AND (
                            cd.expire_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL'30 days' OR
                            cd.insurance_ending_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL'30 days'
                        ))::int +
                    (SELECT COUNT(*) FROM motorbike_documentation md JOIN bikes b ON md.bike_id=b.bike_id
                        WHERE b.agency_id=$1 AND (
                            md.expire_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL'30 days' OR
                            md.insurance_ending_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL'30 days'
                        ))::int
                ) AS expiring_docs
            `, [agencyId]),
            pool.query(
                `SELECT COUNT(*)::int AS expiring_licenses FROM driver_info WHERE agency_id=$1 AND expire_date BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL'30 days'`,
                [agencyId]
            ),
            pool.query(`
                SELECT (
                    (SELECT COUNT(*) FROM agency_reviews WHERE agency_id=$1 AND date=CURRENT_DATE)::int +
                    (SELECT COUNT(*) FROM cars_reviews cr JOIN cars c ON cr.car_id=c.car_id WHERE c.agency_id=$1 AND cr.date=CURRENT_DATE)::int +
                    (SELECT COUNT(*) FROM motorbike_reviews mr JOIN bikes b ON mr.bike_id=b.bike_id WHERE b.agency_id=$1 AND mr.date=CURRENT_DATE)::int +
                    (SELECT COUNT(*) FROM driver_reviews dr JOIN driver_info di ON dr.driver_id=di.driver_id WHERE di.agency_id=$1 AND dr.date=CURRENT_DATE)::int
                ) AS new_reviews_today
            `, [agencyId])
        ]);

        const a = agencyRes.rows[0] || {};
        const s = bookingRes.rows[0];
        const f = fleetRes.rows[0];
        const d = driverRes.rows[0];
        const r = reviewRes.rows[0];
        const dmg = damageRes.rows[0];

        const agencyCount = parseInt(r.agency_count) || 0;
        const carCount = parseInt(r.car_count) || 0;
        const bikeCount = parseInt(r.bike_count) || 0;
        const driverCount = parseInt(r.driver_count) || 0;
        const totalReviewCount = agencyCount + carCount + bikeCount + driverCount;

        let overallRating = 0;
        if (totalReviewCount > 0) {
            overallRating = (
                parseFloat(r.agency_avg) * agencyCount +
                parseFloat(r.car_avg) * carCount +
                parseFloat(r.bike_avg) * bikeCount +
                parseFloat(r.driver_avg) * driverCount
            ) / totalReviewCount;
        }

        const curRating = parseFloat(r.current_month_rating);
        const lstRating = parseFloat(r.last_month_rating);
        const ratingTrend = (!isNaN(curRating) && !isNaN(lstRating))
            ? parseFloat((curRating - lstRating).toFixed(2)) : null;

        const carTotal = parseInt(f.car_count) || 0;
        const bikeTotal = parseInt(f.bike_count) || 0;

        res.json({
            agencyName: a.agency_name || '',
            verified: a.verified || false,
            expireDate: a.expire_date || null,
            agencyStatus: a.status || 'Active',

            totalBookings: parseInt(s.total_bookings) || 0,
            activeBookings: parseInt(s.active_bookings) || 0,
            pendingRequests: parseInt(s.pending_requests) || 0,
            completedTrips: parseInt(s.completed_trips) || 0,
            cancelledBookings: parseInt(s.cancelled_bookings) || 0,
            thisMonthTrips: parseInt(s.this_month_trips) || 0,
            lastMonthTrips: parseInt(s.last_month_trips) || 0,

            totalRevenue: parseInt(s.total_revenue) || 0,
            thisMonthRevenue: parseInt(s.this_month_revenue) || 0,
            lastMonthRevenue: parseInt(s.last_month_revenue) || 0,
            thisWeekRevenue: parseInt(s.this_week_revenue) || 0,
            carRevenue: parseInt(s.car_revenue) || 0,
            bikeRevenue: parseInt(s.bike_revenue) || 0,

            damageRecovered: parseInt(dmg.damage_recovered) || 0,
            damageOutstanding: parseInt(dmg.damage_outstanding) || 0,

            carCount: carTotal,
            bikeCount: bikeTotal,
            fleetTotal: carTotal + bikeTotal,
            fleetAvailability: {
                available: (parseInt(f.cars_available) || 0) + (parseInt(f.bikes_available) || 0),
                booked: (parseInt(f.cars_booked) || 0) + (parseInt(f.bikes_booked) || 0),
                maintenance: (parseInt(f.cars_maintenance) || 0) + (parseInt(f.bikes_maintenance) || 0),
                inactive: (parseInt(f.cars_inactive) || 0) + (parseInt(f.bikes_inactive) || 0),
            },

            driverCount: parseInt(d.driver_count) || 0,
            driverAvailability: {
                available: parseInt(d.drivers_available) || 0,
                unavailable: parseInt(d.drivers_unavailable) || 0,
                suspended: parseInt(d.drivers_suspended) || 0,
            },

            overallRating: parseFloat(overallRating.toFixed(2)),
            totalReviewCount,
            ratingTrend,

            severeOpenReports: parseInt(dmg.severe_open) || 0,
            unpaidDamageCharges: parseInt(dmg.unpaid_charges) || 0,
            expiringDocuments: parseInt(docsRes.rows[0].expiring_docs) || 0,
            expiringDriverLicenses: parseInt(licensesRes.rows[0].expiring_licenses) || 0,
            newReviewsToday: parseInt(todayRes.rows[0].new_reviews_today) || 0,

            bookingDistribution: {
                completed: parseInt(s.completed_trips) || 0,
                active: parseInt(s.active_bookings) || 0,
                pending: parseInt(s.pending_requests) || 0,
                cancelled: parseInt(s.cancelled_bookings) || 0,
            }
        });
    } catch (err) {
        console.error('getAgencyDashboardStats:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRevenueTrend = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const result = await pool.query(`
            WITH months AS (
                SELECT generate_series(
                    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'),
                    DATE_TRUNC('month', CURRENT_DATE),
                    '1 month'
                ) AS month
            ),
            all_data AS (
                SELECT DATE_TRUNC('month', bi.booking_ts) AS month, bi.total_cost
                FROM booking_info bi
                LEFT JOIN cars _vc ON bi.vehicle_id = _vc.car_id AND bi.vehicle_type = 'Car'
                LEFT JOIN bikes _vb ON bi.vehicle_id = _vb.bike_id AND bi.vehicle_type = 'Bike'
                WHERE bi.status='Completed'
                AND bi.booking_ts >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '23 months')
                AND COALESCE(bi.agency_id, _vc.agency_id, _vb.agency_id) = $1
            )
            SELECT
                TO_CHAR(m.month, 'Mon YY') AS label,
                m.month AS raw_month,
                COALESCE(SUM(d.total_cost) FILTER (WHERE d.month=m.month), 0)::bigint AS revenue,
                COALESCE(SUM(d.total_cost) FILTER (WHERE d.month=m.month-INTERVAL'1 year'), 0)::bigint AS prev_revenue
            FROM months m
            LEFT JOIN all_data d ON d.month IN (m.month, m.month-INTERVAL'1 year')
            GROUP BY m.month
            ORDER BY m.month
        `, [agencyId]);

        res.json(result.rows.map(r => ({
            label: r.label,
            revenue: parseInt(r.revenue) || 0,
            prevRevenue: parseInt(r.prev_revenue) || 0,
        })));
    } catch (err) {
        console.error('getRevenueTrend:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRecentBookings = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                bi.booking_id, bi.vehicle_type, bi.start_ts, bi.end_ts, bi.booking_ts,
                bi.total_rent_hours, bi.total_cost, bi.status,
                COALESCE(c.brand, b.brand) AS brand,
                COALESCE(c.model, b.model) AS model,
                COALESCE(c.images[1], b.images[1]) AS vehicle_image,
                u.name AS user_name, u.photo AS user_photo
            FROM booking_info bi
            JOIN users u ON bi.user_id=u.user_id
            LEFT JOIN cars c ON bi.vehicle_id=c.car_id AND bi.vehicle_type='Car'
            LEFT JOIN bikes b ON bi.vehicle_id=b.bike_id AND bi.vehicle_type='Bike'
            WHERE COALESCE(bi.agency_id, c.agency_id, b.agency_id)=$1
            ORDER BY bi.booking_ts DESC
            LIMIT 8
        `, [agencyId]);
        res.json(result.rows);
    } catch (err) {
        console.error('getRecentBookings:', err);
        res.status(500).json({ error: err.message });
    }
};

const getFleetStatus = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const [vehiclesRes, statsRes] = await Promise.all([
            pool.query(`
                SELECT * FROM (
                    SELECT c.car_id AS vehicle_id, c.brand, c.model, c.car_type, c.images[1] AS image,
                           c.status, c.rating::float AS rating, c.rental_price, 'Car'::text AS vehicle_type, c.created_at
                    FROM cars c WHERE c.agency_id=$1
                    UNION ALL
                    SELECT b.bike_id AS vehicle_id, b.brand, b.model, b.car_type, b.images[1] AS image,
                           b.status, b.rating::float AS rating, b.rental_price, 'Bike'::text AS vehicle_type, b.created_at
                    FROM bikes b WHERE b.agency_id=$1
                ) AS fleet
                ORDER BY created_at DESC
                LIMIT 6
            `, [agencyId]),
            pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1)::int AS total_cars,
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1)::int AS total_bikes,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status='Available')::int +
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status='Available')::int AS fleet_available,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status IN ('Booked','Requested'))::int +
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status IN ('Booked','Requested'))::int AS fleet_booked,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status='Maintenance')::int +
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status='Maintenance')::int AS fleet_maintenance,
                    (SELECT COUNT(*) FROM cars WHERE agency_id=$1 AND status IN ('Unavailable','Suspend'))::int +
                    (SELECT COUNT(*) FROM bikes WHERE agency_id=$1 AND status IN ('Unavailable','Suspend'))::int AS fleet_inactive
            `, [agencyId])
        ]);

        const s = statsRes.rows[0];
        res.json({
            vehicles: vehiclesRes.rows,
            totalCars: parseInt(s.total_cars) || 0,
            totalBikes: parseInt(s.total_bikes) || 0,
            totalCount: (parseInt(s.total_cars) || 0) + (parseInt(s.total_bikes) || 0),
            available: parseInt(s.fleet_available) || 0,
            booked: parseInt(s.fleet_booked) || 0,
            maintenance: parseInt(s.fleet_maintenance) || 0,
            inactive: parseInt(s.fleet_inactive) || 0,
        });
    } catch (err) {
        console.error('getFleetStatus:', err);
        res.status(500).json({ error: err.message });
    }
};

const getDriverStatus = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const [driversRes, statsRes] = await Promise.all([
            pool.query(`
                SELECT di.driver_id, di.name, di.photo, di.availability, di.accountstatus,
                       di.rating::float AS rating, di.rental_price, di.license_status, di.expire_date, di.verified
                FROM driver_info di
                WHERE di.agency_id=$1
                ORDER BY di.availability DESC NULLS LAST, di.rating DESC NULLS LAST
                LIMIT 6
            `, [agencyId]),
            pool.query(`
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE availability=true AND accountstatus='Active')::int AS available,
                    COUNT(*) FILTER (WHERE (availability=false OR availability IS NULL) AND accountstatus!='Suspended')::int AS unavailable,
                    COUNT(*) FILTER (WHERE accountstatus='Suspended')::int AS suspended
                FROM driver_info WHERE agency_id=$1
            `, [agencyId])
        ]);

        const s = statsRes.rows[0];
        res.json({
            drivers: driversRes.rows,
            totalCount: parseInt(s.total) || 0,
            available: parseInt(s.available) || 0,
            unavailable: parseInt(s.unavailable) || 0,
            suspended: parseInt(s.suspended) || 0,
        });
    } catch (err) {
        console.error('getDriverStatus:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRecentDamage = async (req, res) => {
    const { agencyId } = req.params;
    const IS_PAID = `EXISTS (
        SELECT 1 FROM payment_info pi
        WHERE pi.booking_id=dr.booking_id
        AND (pi.payment_for ILIKE '%damage%' OR pi.payment_for ILIKE '%repair%')
    )`;
    try {
        const [reportsRes, countRes] = await Promise.all([
            pool.query(`
                SELECT
                    dr.damage_id, dr.severity, dr.damage_type, dr.status,
                    dr.estimated_cost, dr.report_date,
                    COALESCE(c.brand, b.brand) AS brand,
                    COALESCE(c.model, b.model) AS model,
                    ${IS_PAID} AS is_paid,
                    (SELECT COUNT(*) FROM damage_reports dr2
                        WHERE (dr.car_id IS NOT NULL AND dr2.car_id=dr.car_id)
                           OR (dr.bike_id IS NOT NULL AND dr2.bike_id=dr.bike_id))::int AS vehicle_damage_count
                FROM damage_reports dr
                LEFT JOIN cars c ON dr.car_id=c.car_id
                LEFT JOIN bikes b ON dr.bike_id=b.bike_id
                WHERE COALESCE(c.agency_id, b.agency_id)=$1
                ORDER BY dr.report_date DESC
                LIMIT 5
            `, [agencyId]),
            pool.query(
                `SELECT COUNT(*)::int AS total FROM damage_reports dr
                 LEFT JOIN cars c ON dr.car_id=c.car_id
                 LEFT JOIN bikes b ON dr.bike_id=b.bike_id
                 WHERE COALESCE(c.agency_id, b.agency_id)=$1`,
                [agencyId]
            )
        ]);
        res.json({ reports: reportsRes.rows, totalCount: parseInt(countRes.rows[0].total) || 0 });
    } catch (err) {
        console.error('getRecentDamage:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRecentReviews = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const result = await pool.query(`
            SELECT * FROM (
                SELECT 'Agency'::text AS review_type, ar.rating, ar.review, ar.date,
                       u.name AS reviewer_name, u.photo AS reviewer_photo,
                       ag.agency_name AS subject_name, NULL::text AS subject_image
                FROM agency_reviews ar
                JOIN users u ON ar.user_id=u.user_id
                JOIN agencies ag ON ar.agency_id=ag.agency_id
                WHERE ar.agency_id=$1

                UNION ALL

                SELECT 'Car'::text AS review_type, cr.rating, cr.review, cr.date,
                       u.name AS reviewer_name, u.photo AS reviewer_photo,
                       (c.brand||' '||c.model) AS subject_name, c.images[1] AS subject_image
                FROM cars_reviews cr
                JOIN users u ON cr.user_id=u.user_id
                JOIN cars c ON cr.car_id=c.car_id
                WHERE c.agency_id=$1

                UNION ALL

                SELECT 'Bike'::text AS review_type, mr.rating, mr.review, mr.date,
                       u.name AS reviewer_name, u.photo AS reviewer_photo,
                       (b.brand||' '||b.model) AS subject_name, b.images[1] AS subject_image
                FROM motorbike_reviews mr
                JOIN users u ON mr.user_id=u.user_id
                JOIN bikes b ON mr.bike_id=b.bike_id
                WHERE b.agency_id=$1

                UNION ALL

                SELECT 'Driver'::text AS review_type, dr.rating, dr.review, dr.date,
                       u.name AS reviewer_name, u.photo AS reviewer_photo,
                       di.name AS subject_name, di.photo AS subject_image
                FROM driver_reviews dr
                JOIN users u ON dr.user_id=u.user_id
                JOIN driver_info di ON dr.driver_id=di.driver_id
                WHERE di.agency_id=$1
            ) AS combined
            ORDER BY date DESC NULLS LAST
            LIMIT 5
        `, [agencyId]);
        res.json(result.rows);
    } catch (err) {
        console.error('getRecentReviews:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAgencyDashboardStats,
    getRevenueTrend,
    getRecentBookings,
    getFleetStatus,
    getDriverStatus,
    getRecentDamage,
    getRecentReviews,
};
