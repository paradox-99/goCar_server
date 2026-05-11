const pool = require('../config/db');

const getAdminInfo = async (req, res) => {
    try {
        const email = req.user?.email;
        if (!email) return res.json({ name: 'Admin' });
        const r = await pool.query(`SELECT name FROM users WHERE email = $1`, [email]);
        res.json({ name: r.rows[0]?.name || 'Admin' });
    } catch {
        res.json({ name: 'Admin' });
    }
};

const getStats = async (req, res) => {
    try {
        const [uRes, agRes, drRes, cRes, bRes, bkRes, rvRes, bannerRes, healthRes, pendingRes] = await Promise.all([
            pool.query(`
                SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS new_this_month
                FROM users WHERE userrole = 'user'
            `),
            pool.query(`
                SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE verified = true AND status = 'Active')::int AS active,
                    COUNT(*) FILTER (WHERE verified = false)::int AS pending
                FROM agencies
            `),
            pool.query(`
                SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE verified = true)::int AS verified,
                    COUNT(*) FILTER (WHERE availability = true AND accountstatus = 'Active')::int AS available
                FROM driver_info
            `),
            pool.query(`
                SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'Available')::int AS available,
                    COUNT(*) FILTER (WHERE status IN ('Booked','Requested'))::int AS booked
                FROM cars
            `),
            pool.query(`
                SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'Available')::int AS available,
                    COUNT(*) FILTER (WHERE status IN ('Booked','Requested'))::int AS booked
                FROM bikes
            `),
            pool.query(`
                SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE DATE(booking_ts) = CURRENT_DATE)::int AS today,
                    COUNT(*) FILTER (WHERE DATE_TRUNC('month', booking_ts) = DATE_TRUNC('month', CURRENT_DATE))::int AS this_month,
                    COUNT(*) FILTER (WHERE status = 'Completed' AND DATE(booking_ts) = CURRENT_DATE)::int AS today_completed,
                    COUNT(*) FILTER (WHERE status = 'Running' AND DATE(booking_ts) = CURRENT_DATE)::int AS today_ongoing,
                    COUNT(*) FILTER (WHERE status = 'Requested' AND DATE(booking_ts) = CURRENT_DATE)::int AS today_pending,
                    COUNT(*) FILTER (WHERE status = 'Confirmed' AND DATE(booking_ts) = CURRENT_DATE)::int AS today_confirmed,
                    COUNT(*) FILTER (WHERE status = 'Cancelled' AND DATE(booking_ts) = CURRENT_DATE)::int AS today_cancelled,
                    COUNT(*) FILTER (WHERE status = 'Completed')::int AS total_completed,
                    COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS total_cancelled,
                    COUNT(*) FILTER (WHERE status IN ('Running','Confirmed'))::int AS active,
                    COUNT(*) FILTER (WHERE status = 'Overdue')::int AS overdue
                FROM booking_info
            `),
            pool.query(`
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE DATE(date) = CURRENT_DATE), 0)::bigint AS today,
                    COUNT(*) FILTER (WHERE DATE(date) = CURRENT_DATE)::int AS today_txns,
                    COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)), 0)::bigint AS this_month,
                    COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL'1 month')), 0)::bigint AS last_month,
                    COALESCE(SUM(amount), 0)::bigint AS total
                FROM payment_info
            `),
            pool.query(`
                SELECT
                    (SELECT COUNT(*)::int FROM booking_info WHERE status = 'Overdue') AS overdue_bookings,
                    (SELECT COUNT(*)::int FROM damage_reports WHERE severity = 'High' AND status = 'Pending') AS severe_damage,
                    (SELECT COUNT(DISTINCT vehicle_id)::int FROM (
                        SELECT car_id AS vehicle_id FROM cars_documentation WHERE expire_date < CURRENT_DATE
                        UNION SELECT car_id AS vehicle_id FROM cars_documentation WHERE insurance_ending_date < CURRENT_DATE
                        UNION SELECT bike_id AS vehicle_id FROM motorbike_documentation WHERE expire_date < CURRENT_DATE
                        UNION SELECT bike_id AS vehicle_id FROM motorbike_documentation WHERE insurance_ending_date < CURRENT_DATE
                    ) AS ed) AS expired_vehicle_docs,
                    (SELECT COUNT(*)::int FROM driver_info WHERE license_status = 'Expired' OR (expire_date IS NOT NULL AND expire_date < CURRENT_DATE)) AS expired_driver_licenses,
                    (SELECT COUNT(*)::int FROM agencies WHERE verified = false) +
                    (SELECT COUNT(*)::int FROM driver_info WHERE verified = false) +
                    (SELECT COUNT(*)::int FROM cars WHERE verified = false) +
                    (SELECT COUNT(*)::int FROM bikes WHERE verified = false) AS pending_approvals,
                    (SELECT COUNT(*)::int FROM agencies WHERE verified = false) AS pending_agencies,
                    (SELECT COUNT(*)::int FROM users WHERE expire_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL'30 days') +
                    (SELECT COUNT(*)::int FROM driver_info WHERE expire_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL'30 days') AS expiring_soon,
                    (SELECT COUNT(*)::int FROM booking_info WHERE status = 'Completed' AND final_payment = false) AS unpaid_finals,
                    (SELECT COUNT(*)::int FROM cars WHERE rating < 2.5 AND rating_count > 0) +
                    (SELECT COUNT(*)::int FROM bikes WHERE rating < 2.5 AND rating_count > 0) +
                    (SELECT COUNT(*)::int FROM agencies WHERE rating < 2.5 AND rating_count > 0) +
                    (SELECT COUNT(*)::int FROM driver_info WHERE rating < 2.5 AND rating_count > 0) AS low_rated
            `),
            pool.query(`
                SELECT
                    (SELECT COUNT(*)::float FROM booking_info WHERE status='Completed') /
                    NULLIF((SELECT COUNT(*) FROM booking_info), 0) AS completion_rate,
                    (SELECT COUNT(*)::float FROM booking_info WHERE status='Cancelled') /
                    NULLIF((SELECT COUNT(*) FROM booking_info), 0) AS cancellation_rate,
                    ((SELECT COUNT(*) FROM cars WHERE status IN ('Booked','Requested')) +
                     (SELECT COUNT(*) FROM bikes WHERE status IN ('Booked','Requested')))::float /
                    NULLIF((SELECT COUNT(*) FROM cars) + (SELECT COUNT(*) FROM bikes), 0) AS fleet_utilization,
                    (SELECT AVG(r) FROM (
                        SELECT rating AS r FROM cars_reviews
                        UNION ALL SELECT rating FROM motorbike_reviews
                        UNION ALL SELECT rating FROM agency_reviews
                        UNION ALL SELECT rating FROM driver_reviews
                    ) AS all_r) AS avg_platform_rating,
                    (SELECT COUNT(*) FROM cars_reviews) + (SELECT COUNT(*) FROM motorbike_reviews) +
                    (SELECT COUNT(*) FROM agency_reviews) + (SELECT COUNT(*) FROM driver_reviews) AS total_reviews,
                    (SELECT COUNT(*)::int FROM notifications WHERE is_read = false) AS unread_notifications,
                    -- Verification rate (verified cars+bikes+drivers) / total
                    (SELECT COUNT(*) FILTER (WHERE verified=true) FROM cars)::float +
                    (SELECT COUNT(*) FILTER (WHERE verified=true) FROM bikes)::float +
                    (SELECT COUNT(*) FILTER (WHERE verified=true) FROM driver_info)::float AS verified_total,
                    (SELECT COUNT(*) FROM cars)::float + (SELECT COUNT(*) FROM bikes)::float +
                    (SELECT COUNT(*) FROM driver_info)::float AS entity_total
            `),
            pool.query(`
                SELECT
                    (SELECT COUNT(*)::int FROM agencies WHERE verified = false) AS pending_agency_verif,
                    (SELECT COUNT(*)::int FROM driver_info WHERE verified = false) AS pending_driver_verif,
                    (SELECT COUNT(*)::int FROM cars WHERE verified = false) AS pending_car_verif,
                    (SELECT COUNT(*)::int FROM bikes WHERE verified = false) AS pending_bike_verif,
                    (SELECT COUNT(*)::int FROM users WHERE license_status = 'Unverified' AND license_number IS NOT NULL) +
                    (SELECT COUNT(*)::int FROM driver_info WHERE license_status = 'Unverified') AS pending_licenses
            `)
        ]);

        const u = uRes.rows[0];
        const ag = agRes.rows[0];
        const dr = drRes.rows[0];
        const c = cRes.rows[0];
        const b = bRes.rows[0];
        const bk = bkRes.rows[0];
        const rv = rvRes.rows[0];
        const banner = bannerRes.rows[0];
        const health = healthRes.rows[0];
        const pend = pendingRes.rows[0];

        const monthRevPct = rv.last_month > 0
            ? parseFloat(((rv.this_month - rv.last_month) / rv.last_month * 100).toFixed(1))
            : rv.this_month > 0 ? 100 : 0;

        const verifyRate = health.entity_total > 0
            ? parseFloat((health.verified_total / health.entity_total * 100).toFixed(1)) : 0;

        res.json({
            totalUsers: u.total,
            newUsersThisMonth: u.new_this_month,
            totalAgencies: ag.total,
            activeAgencies: ag.active,
            pendingAgencies: ag.pending,
            totalDrivers: dr.total,
            verifiedDrivers: dr.verified,
            availableDrivers: dr.available,
            totalCars: c.total,
            availableCars: c.available,
            bookedCars: c.booked,
            totalBikes: b.total,
            availableBikes: b.available,
            bookedBikes: b.booked,
            totalBookings: bk.total,
            todayBookings: bk.today,
            thisMonthBookings: bk.this_month,
            todayCompleted: bk.today_completed,
            todayOngoing: bk.today_ongoing,
            todayPending: bk.today_pending,
            todayConfirmed: bk.today_confirmed,
            todayCancelled: bk.today_cancelled,
            totalCompleted: bk.total_completed,
            totalCancelled: bk.total_cancelled,
            activeBookings: bk.active,
            overdueBookings: bk.overdue,
            todayRevenue: parseInt(rv.today),
            todayTransactions: rv.today_txns,
            thisMonthRevenue: parseInt(rv.this_month),
            lastMonthRevenue: parseInt(rv.last_month),
            totalRevenue: parseInt(rv.total),
            monthRevenuePctChange: monthRevPct,
            banners: {
                overdueBookings: parseInt(banner.overdue_bookings) || 0,
                severeDamage: parseInt(banner.severe_damage) || 0,
                expiredVehicleDocs: parseInt(banner.expired_vehicle_docs) || 0,
                expiredDriverLicenses: parseInt(banner.expired_driver_licenses) || 0,
                pendingApprovals: parseInt(banner.pending_approvals) || 0,
                pendingAgencies: parseInt(banner.pending_agencies) || 0,
                expiringSoon: parseInt(banner.expiring_soon) || 0,
                unpaidFinals: parseInt(banner.unpaid_finals) || 0,
                lowRated: parseInt(banner.low_rated) || 0,
            },
            health: {
                completionRate: parseFloat(((health.completion_rate || 0) * 100).toFixed(1)),
                cancellationRate: parseFloat(((health.cancellation_rate || 0) * 100).toFixed(1)),
                fleetUtilization: parseFloat(((health.fleet_utilization || 0) * 100).toFixed(1)),
                avgPlatformRating: parseFloat(parseFloat(health.avg_platform_rating || 0).toFixed(2)),
                totalReviews: parseInt(health.total_reviews) || 0,
                unreadNotifications: parseInt(health.unread_notifications) || 0,
                verificationRate: verifyRate,
            },
            pendingBreakdown: {
                agencies: parseInt(pend.pending_agency_verif) || 0,
                drivers: parseInt(pend.pending_driver_verif) || 0,
                cars: parseInt(pend.pending_car_verif) || 0,
                bikes: parseInt(pend.pending_bike_verif) || 0,
                licenses: parseInt(pend.pending_licenses) || 0,
            }
        });
    } catch (err) {
        console.error('getStats:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRevenueChart = async (req, res) => {
    const { period = 'month' } = req.query;
    try {
        let seriesQ, prevQ, labelFmt, startExpr, prevStartExpr;

        if (period === 'week') {
            startExpr = `CURRENT_DATE - INTERVAL '6 days'`;
            prevStartExpr = `CURRENT_DATE - INTERVAL '13 days'`;
            labelFmt = `TO_CHAR(s.dt, 'Dy')`;
            seriesQ = `generate_series(CURRENT_DATE-INTERVAL'6 days', CURRENT_DATE, '1 day')`;
        } else if (period === 'month') {
            startExpr = `DATE_TRUNC('month', CURRENT_DATE)`;
            prevStartExpr = `DATE_TRUNC('month', CURRENT_DATE-INTERVAL'1 month')`;
            labelFmt = `TO_CHAR(s.dt, 'DD')`;
            seriesQ = `generate_series(DATE_TRUNC('month',CURRENT_DATE), CURRENT_DATE, '1 day')`;
        } else if (period === '3months') {
            startExpr = `DATE_TRUNC('month', CURRENT_DATE-INTERVAL'2 months')`;
            prevStartExpr = `DATE_TRUNC('month', CURRENT_DATE-INTERVAL'5 months')`;
            labelFmt = `TO_CHAR(DATE_TRUNC('week', s.dt), 'Mon DD')`;
            seriesQ = `generate_series(DATE_TRUNC('month',CURRENT_DATE-INTERVAL'2 months'), CURRENT_DATE, '1 week')`;
        } else {
            startExpr = `DATE_TRUNC('year', CURRENT_DATE)`;
            prevStartExpr = `DATE_TRUNC('year', CURRENT_DATE-INTERVAL'1 year')`;
            labelFmt = `TO_CHAR(DATE_TRUNC('month', s.dt), 'Mon')`;
            seriesQ = `generate_series(DATE_TRUNC('year',CURRENT_DATE), CURRENT_DATE, '1 month')`;
        }

        const groupBy = period === 'week' ? `DATE_TRUNC('day', date)` :
                        period === 'month' ? `DATE_TRUNC('day', date)` :
                        period === '3months' ? `DATE_TRUNC('week', date)` :
                        `DATE_TRUNC('month', date)`;

        const result = await pool.query(`
            WITH series AS (SELECT dt::date FROM ${seriesQ} AS dt),
            current_period AS (
                SELECT ${groupBy} AS dt, COALESCE(SUM(amount),0)::bigint AS revenue, COUNT(*)::int AS txns
                FROM payment_info WHERE date >= ${startExpr} GROUP BY 1
            ),
            prev_period AS (
                SELECT ${groupBy} + (${startExpr} - ${prevStartExpr}) AS dt_shifted,
                       COALESCE(SUM(amount),0)::bigint AS prev_revenue
                FROM payment_info WHERE date >= ${prevStartExpr} AND date < ${startExpr}
                GROUP BY ${groupBy}
            )
            SELECT ${labelFmt} AS label, s.dt,
                   COALESCE(cp.revenue, 0) AS revenue,
                   COALESCE(pp.prev_revenue, 0) AS prev_revenue,
                   COALESCE(cp.txns, 0) AS transactions
            FROM series s
            LEFT JOIN current_period cp ON cp.dt = s.dt::timestamp
            LEFT JOIN prev_period pp ON pp.dt_shifted = s.dt::timestamp
            ORDER BY s.dt
        `);

        const rows = result.rows;
        const total = rows.reduce((s, r) => s + parseInt(r.revenue), 0);
        const best = Math.max(...rows.map(r => parseInt(r.revenue)));
        const avg = rows.length > 0 ? Math.round(total / rows.length) : 0;

        res.json({
            data: rows.map(r => ({
                label: r.label,
                revenue: parseInt(r.revenue),
                prevRevenue: parseInt(r.prev_revenue),
                transactions: parseInt(r.transactions),
            })),
            summary: { total, best, avg }
        });
    } catch (err) {
        console.error('getRevenueChart:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRecentBookings = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT bi.booking_id, bi.vehicle_type, bi.start_ts, bi.end_ts, bi.booking_ts,
                   bi.total_cost, bi.status,
                   COALESCE(c.brand, b.brand) AS brand, COALESCE(c.model, b.model) AS model,
                   COALESCE(c.images[1], b.images[1]) AS vehicle_image,
                   u.name AS customer_name, u.photo AS customer_photo
            FROM booking_info bi
            JOIN users u ON bi.user_id = u.user_id
            LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND bi.vehicle_type = 'Car'
            LEFT JOIN bikes b ON bi.vehicle_id = b.bike_id AND bi.vehicle_type = 'Bike'
            ORDER BY bi.booking_ts DESC
            LIMIT 8
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('getRecentBookings:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRecentDamage = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT dr.damage_id, dr.severity, dr.damage_type, dr.status, dr.report_date,
                   c.brand, c.model,
                   u.name AS reported_by_name
            FROM damage_reports dr
            JOIN cars c ON dr.car_id = c.car_id
            LEFT JOIN users u ON dr.reported_by = u.user_id
            ORDER BY dr.report_date DESC
            LIMIT 6
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('getRecentDamage:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRecentNotifications = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT n.notif_id, n.message, n.created_at, n.is_read,
                   u.name AS user_name, u.photo AS user_photo
            FROM notifications n
            LEFT JOIN users u ON n.user_id = u.user_id
            ORDER BY n.created_at DESC
            LIMIT 6
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('getRecentNotifications:', err);
        res.status(500).json({ error: err.message });
    }
};

const getUpcomingBookings = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT bi.booking_id, bi.vehicle_type, bi.start_ts, bi.end_ts, bi.total_cost, bi.status,
                   COALESCE(c.brand, b.brand) AS brand, COALESCE(c.model, b.model) AS model,
                   COALESCE(c.images[1], b.images[1]) AS vehicle_image,
                   u.name AS customer_name, u.phone AS customer_phone,
                   di.name AS driver_name
            FROM booking_info bi
            JOIN users u ON bi.user_id = u.user_id
            LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND bi.vehicle_type = 'Car'
            LEFT JOIN bikes b ON bi.vehicle_id = b.bike_id AND bi.vehicle_type = 'Bike'
            LEFT JOIN driver_info di ON bi.driver_id = di.driver_id
            WHERE bi.start_ts BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            AND bi.status NOT IN ('Cancelled', 'Completed')
            ORDER BY bi.start_ts ASC
            LIMIT 8
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('getUpcomingBookings:', err);
        res.status(500).json({ error: err.message });
    }
};

const getTopPerformers = async (req, res) => {
    try {
        const [agencyRes, driverRes, carRes, bikeRes] = await Promise.all([
            pool.query(`
                SELECT ag.agency_id, ag.agency_name, ag.rating::float, ag.cars, ag.bikes,
                       COALESCE(SUM(pi.amount), 0)::bigint AS monthly_revenue
                FROM agencies ag
                LEFT JOIN booking_info bi ON bi.agency_id = ag.agency_id
                    AND DATE_TRUNC('month', bi.booking_ts) = DATE_TRUNC('month', CURRENT_DATE)
                    AND bi.status = 'Completed'
                LEFT JOIN payment_info pi ON pi.booking_id = bi.booking_id
                GROUP BY ag.agency_id, ag.agency_name, ag.rating, ag.cars, ag.bikes
                ORDER BY monthly_revenue DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT di.driver_id, di.name, di.photo, di.rating::float,
                       ag.agency_name,
                       COUNT(bi.booking_id)::int AS monthly_trips
                FROM driver_info di
                LEFT JOIN booking_info bi ON bi.driver_id = di.driver_id
                    AND bi.status = 'Completed'
                    AND DATE_TRUNC('month', bi.booking_ts) = DATE_TRUNC('month', CURRENT_DATE)
                LEFT JOIN agencies ag ON di.agency_id = ag.agency_id
                GROUP BY di.driver_id, di.name, di.photo, di.rating, ag.agency_name
                ORDER BY monthly_trips DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT c.car_id AS vehicle_id, c.brand, c.model, c.images[1] AS image,
                       c.rating::float, ag.agency_name,
                       COUNT(bi.booking_id)::int AS monthly_bookings
                FROM cars c
                LEFT JOIN booking_info bi ON bi.vehicle_id = c.car_id
                    AND DATE_TRUNC('month', bi.booking_ts) = DATE_TRUNC('month', CURRENT_DATE)
                    AND bi.status != 'Cancelled'
                LEFT JOIN agencies ag ON c.agency_id = ag.agency_id
                GROUP BY c.car_id, c.brand, c.model, c.images, c.rating, ag.agency_name
                ORDER BY monthly_bookings DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT b.bike_id AS vehicle_id, b.brand, b.model, b.images[1] AS image,
                       b.rating::float, ag.agency_name,
                       COUNT(bi.booking_id)::int AS monthly_bookings
                FROM bikes b
                LEFT JOIN booking_info bi ON bi.vehicle_id = b.bike_id
                    AND DATE_TRUNC('month', bi.booking_ts) = DATE_TRUNC('month', CURRENT_DATE)
                    AND bi.status != 'Cancelled'
                LEFT JOIN agencies ag ON b.agency_id = ag.agency_id
                GROUP BY b.bike_id, b.brand, b.model, b.images, b.rating, ag.agency_name
                ORDER BY monthly_bookings DESC
                LIMIT 5
            `)
        ]);
        res.json({
            agencies: agencyRes.rows,
            drivers: driverRes.rows,
            cars: carRes.rows,
            bikes: bikeRes.rows,
        });
    } catch (err) {
        console.error('getTopPerformers:', err);
        res.status(500).json({ error: err.message });
    }
};

const getRevenueByMethod = async (req, res) => {
    const { period = 'month' } = req.query;
    let startExpr = period === 'today' ? `CURRENT_DATE`
        : period === 'week' ? `CURRENT_DATE - INTERVAL '7 days'`
        : `DATE_TRUNC('month', CURRENT_DATE)`;
    try {
        const result = await pool.query(`
            SELECT method_type AS method,
                   COALESCE(SUM(amount), 0)::bigint AS revenue,
                   COUNT(*)::int AS txn_count
            FROM payment_info
            WHERE date >= ${startExpr}
            GROUP BY method_type
            ORDER BY revenue DESC
        `);
        const rows = result.rows;
        const total = rows.reduce((s, r) => s + parseInt(r.revenue), 0) || 1;
        res.json(rows.map(r => ({
            method: r.method || 'Unknown',
            revenue: parseInt(r.revenue),
            txnCount: r.txn_count,
            pct: parseFloat(((parseInt(r.revenue) / total) * 100).toFixed(1)),
        })));
    } catch (err) {
        console.error('getRevenueByMethod:', err);
        res.status(500).json({ error: err.message });
    }
};

const globalSearch = async (req, res) => {
    const { q = '' } = req.query;
    if (!q.trim() || q.trim().length < 2) return res.json({ users: [], agencies: [], cars: [], bikes: [], drivers: [], bookings: [] });
    const pattern = `%${q.trim()}%`;
    try {
        const [uRes, agRes, cRes, bRes, drRes, bkRes] = await Promise.all([
            pool.query(`SELECT user_id AS id, name, email, userrole, accountstatus::text AS status, photo FROM users WHERE name ILIKE $1 OR email ILIKE $1 LIMIT 3`, [pattern]),
            pool.query(`SELECT ag.agency_id AS id, ag.agency_name AS name, ag.email, ag.status::text AS status, ad.city FROM agencies ag JOIN address ad ON ag.address_id = ad.address_id WHERE ag.agency_name ILIKE $1 OR ag.email ILIKE $1 LIMIT 3`, [pattern]),
            pool.query(`SELECT c.car_id AS id, (c.brand||' '||c.model) AS name, ag.agency_name, c.status::text AS status, c.images[1] AS photo FROM cars c LEFT JOIN agencies ag ON c.agency_id = ag.agency_id WHERE c.brand ILIKE $1 OR c.model ILIKE $1 OR c.car_id ILIKE $1 LIMIT 3`, [pattern]),
            pool.query(`SELECT b.bike_id AS id, (b.brand||' '||b.model) AS name, ag.agency_name, b.status::text AS status, b.images[1] AS photo FROM bikes b LEFT JOIN agencies ag ON b.agency_id = ag.agency_id WHERE b.brand ILIKE $1 OR b.model ILIKE $1 OR b.bike_id ILIKE $1 LIMIT 3`, [pattern]),
            pool.query(`SELECT di.driver_id AS id, di.name, di.email, di.phone, di.rating::float, di.accountstatus::text AS status, di.photo FROM driver_info di WHERE di.name ILIKE $1 OR di.email ILIKE $1 OR di.phone ILIKE $1 LIMIT 3`, [pattern]),
            pool.query(`SELECT bi.booking_id AS id, bi.status::text, bi.total_cost, u.name AS customer_name, COALESCE(c.brand||' '||c.model, bk.brand||' '||bk.model) AS vehicle FROM booking_info bi JOIN users u ON bi.user_id = u.user_id LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND bi.vehicle_type = 'Car' LEFT JOIN bikes bk ON bi.vehicle_id = bk.bike_id AND bi.vehicle_type = 'Bike' WHERE bi.booking_id ILIKE $1 OR u.name ILIKE $1 LIMIT 3`, [pattern])
        ]);
        res.json({ users: uRes.rows, agencies: agRes.rows, cars: cRes.rows, bikes: bRes.rows, drivers: drRes.rows, bookings: bkRes.rows });
    } catch (err) {
        console.error('globalSearch:', err);
        res.status(500).json({ error: err.message });
    }
};

const getCalendarData = async (req, res) => {
    const { year, month } = req.query;
    const dateParam = year && month ? `${year}-${String(month).padStart(2,'0')}-01` : 'today';
    try {
        const result = await pool.query(`
            SELECT DATE(start_ts) AS day, COUNT(*)::int AS count
            FROM booking_info
            WHERE DATE_TRUNC('month', start_ts) = DATE_TRUNC('month', $1::date)
            AND status != 'Cancelled'
            GROUP BY DATE(start_ts)
            ORDER BY day
        `, [dateParam]);
        res.json(result.rows.reduce((acc, r) => {
            acc[r.day.toISOString().slice(0, 10)] = r.count;
            return acc;
        }, {}));
    } catch (err) {
        console.error('getCalendarData:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAdminInfo,
    getStats,
    getRevenueChart,
    getRecentBookings,
    getRecentDamage,
    getRecentNotifications,
    getUpcomingBookings,
    getTopPerformers,
    getRevenueByMethod,
    globalSearch,
    getCalendarData,
};
