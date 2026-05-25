const pool = require('../config/db');

const getDamageStats = async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                COUNT(*) as total_reports,
                COUNT(*) FILTER (WHERE status = 'Pending') as open_reports,
                COUNT(*) FILTER (WHERE status = 'On-Review') as under_review,
                COUNT(*) FILTER (WHERE status = 'Resolved') as resolved,
                COALESCE(SUM(estimated_cost), 0) as total_cost,
                (SELECT COUNT(*) FROM (
                    SELECT car_id FROM damage_reports WHERE car_id IS NOT NULL GROUP BY car_id HAVING COUNT(*) > 1
                    UNION ALL
                    SELECT bike_id FROM damage_reports WHERE bike_id IS NOT NULL GROUP BY bike_id HAVING COUNT(*) > 1
                ) as repeats) as repeat_offenders
            FROM damage_reports
        `);

        const banners = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE severity = 'High' AND status = 'Pending') as severe_open,
                COUNT(*) FILTER (WHERE status = 'On-Review' AND report_date < CURRENT_DATE - INTERVAL '7 days') as stale_review,
                COUNT(*) FILTER (WHERE estimated_cost IS NULL OR estimated_cost = 0) as missing_cost
            FROM damage_reports
        `);

        res.json({
            stats: stats.rows[0],
            banners: banners.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getDamageReports = async (req, res) => {
    const {
        search, status, severity, damage_type, car_id, agency_id,
        startDate, endDate, costRange, page = 0, limit = 10
    } = req.query;

    const offset = page * limit;
    let params = [];
    let whereClauses = [];

    if (search) {
        params.push(`%${search}%`);
        whereClauses.push(`(dr.damage_id ILIKE $${params.length} OR dr.booking_id ILIKE $${params.length} OR COALESCE(c.brand, b.brand) ILIKE $${params.length} OR COALESCE(c.model, b.model) ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }

    if (status && status !== 'All') {
        const statusMap = { 'Open': 'Pending', 'Under Review': 'On-Review', 'Resolved': 'Resolved' };
        params.push(statusMap[status] || status);
        whereClauses.push(`dr.status = $${params.length}`);
    }

    if (severity && severity !== 'All') {
        const severityMap = { 'Minor': 'Low', 'Moderate': 'Medium', 'Severe': 'High' };
        params.push(severityMap[severity] || severity);
        whereClauses.push(`dr.severity = $${params.length}`);
    }

    if (damage_type && damage_type !== 'All') {
        params.push(damage_type);
        whereClauses.push(`dr.damage_type = $${params.length}`);
    }

    if (car_id && car_id !== 'All') {
        params.push(car_id);
        whereClauses.push(`(dr.car_id = $${params.length} OR dr.bike_id = $${params.length})`);
    }

    if (agency_id && agency_id !== 'All') {
        params.push(agency_id);
        whereClauses.push(`COALESCE(c.agency_id, b.agency_id) = $${params.length}`);
    }

    if (startDate && endDate) {
        params.push(startDate, endDate);
        whereClauses.push(`dr.report_date BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    if (costRange && costRange !== 'All') {
        if (costRange === 'No Estimate') {
            whereClauses.push(`(dr.estimated_cost IS NULL OR dr.estimated_cost = 0)`);
        } else if (costRange === 'Under 5,000') {
            whereClauses.push(`dr.estimated_cost < 5000`);
        } else if (costRange === '5,000–20,000') {
            whereClauses.push(`dr.estimated_cost BETWEEN 5000 AND 20000`);
        } else if (costRange === '20,000–50,000') {
            whereClauses.push(`dr.estimated_cost BETWEEN 20000 AND 50000`);
        } else if (costRange === 'Above 50,000') {
            whereClauses.push(`dr.estimated_cost > 50000`);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
        const query = `
            SELECT
                dr.*,
                COALESCE(c.brand, b.brand) AS brand,
                COALESCE(c.model, b.model) AS model,
                COALESCE(c.car_type, b.car_type) AS car_type,
                COALESCE(c.images[1], b.images[1]) AS car_image,
                a.agency_name,
                u.name as reporter_name, u.phone as reporter_phone, u.userrole as reporter_role,
                (SELECT COUNT(*) FROM damage_reports dr2
                    WHERE (dr.car_id IS NOT NULL AND dr2.car_id = dr.car_id)
                       OR (dr.bike_id IS NOT NULL AND dr2.bike_id = dr.bike_id)) as vehicle_damage_count
            FROM damage_reports dr
            LEFT JOIN cars c ON dr.car_id = c.car_id
            LEFT JOIN bikes b ON dr.bike_id = b.bike_id
            JOIN agencies a ON COALESCE(c.agency_id, b.agency_id) = a.agency_id
            JOIN users u ON dr.reported_by = u.user_id
            ${whereSql}
            ORDER BY
                CASE
                    WHEN dr.severity = 'High' AND dr.status = 'Pending' THEN 1
                    WHEN dr.severity = 'Medium' AND dr.status = 'Pending' THEN 2
                    WHEN dr.severity = 'Low' AND dr.status = 'Pending' THEN 3
                    WHEN dr.severity = 'High' AND dr.status = 'On-Review' THEN 4
                    WHEN dr.severity = 'Medium' AND dr.status = 'On-Review' THEN 5
                    WHEN dr.severity = 'Low' AND dr.status = 'On-Review' THEN 6
                    ELSE 7
                END,
                dr.report_date ASC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*)
            FROM damage_reports dr
            LEFT JOIN cars c ON dr.car_id = c.car_id
            LEFT JOIN bikes b ON dr.bike_id = b.bike_id
            JOIN agencies a ON COALESCE(c.agency_id, b.agency_id) = a.agency_id
            JOIN users u ON dr.reported_by = u.user_id
            ${whereSql}
        `;

        const [results, count] = await Promise.all([
            pool.query(query, [...params, limit, offset]),
            pool.query(countQuery, params)
        ]);

        res.json({
            reports: results.rows,
            total: parseInt(count.rows[0].count)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getDamageDetail = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await pool.query(`
            SELECT
                dr.*,
                COALESCE(c.brand, b.brand) AS brand,
                COALESCE(c.model, b.model) AS model,
                COALESCE(c.car_type, b.car_type) AS car_type,
                c.build_year,
                COALESCE(c.images, b.images) AS images,
                COALESCE(c.status, b.status) AS car_status,
                COALESCE(c.verified, b.verified) AS car_verified,
                COALESCE(c.rating, b.rating) AS car_rating,
                a.agency_name, a.agency_id,
                u.name as reporter_name, u.email as reporter_email, u.phone as reporter_phone, u.photo as reporter_photo, u.gender as reporter_gender, u.accountstatus as reporter_status, u.verified as reporter_verified, u.userrole as reporter_role,
                bi.start_ts, bi.end_ts, bi.status as booking_status, bi.booking_purpose, bi.estimated_destination, bi.total_rent_hours,
                cu.name as customer_name, cu.email as customer_email, cu.phone as customer_phone, cu.accountstatus as customer_status,
                d.name as driver_name, d.phone as driver_phone, d.license_status as driver_license_status,
                pi.pickup_time, pi.fuel_level as pickup_fuel, pi.odometer_reading as pickup_odometer, pi.pickup_notes,
                ri.return_time, ri.fuel_level as return_fuel, ri.odometer_reading as return_odometer, ri.late_fee, ri.fuel_charge, ri.cleaning_charge, ri.return_notes
            FROM damage_reports dr
            LEFT JOIN cars c ON dr.car_id = c.car_id
            LEFT JOIN bikes b ON dr.bike_id = b.bike_id
            JOIN agencies a ON COALESCE(c.agency_id, b.agency_id) = a.agency_id
            JOIN users u ON dr.reported_by = u.user_id
            JOIN booking_info bi ON dr.booking_id = bi.booking_id
            JOIN users cu ON bi.user_id = cu.user_id
            LEFT JOIN driver_info d ON bi.driver_id = d.driver_id
            LEFT JOIN pickup_info pi ON bi.booking_id = pi.booking_id
            LEFT JOIN return_info ri ON bi.booking_id = ri.booking_id
            WHERE dr.damage_id = $1
        `, [id]);

        if (report.rowCount === 0) return res.status(404).json({ message: 'Report not found' });

        const r = report.rows[0];

        const [history, payments, reporterStats] = await Promise.all([
            pool.query(`
                SELECT damage_id, report_date, severity, damage_type, status, estimated_cost
                FROM damage_reports
                WHERE ($1::text IS NOT NULL AND car_id = $1)
                   OR ($2::text IS NOT NULL AND bike_id = $2)
                ORDER BY report_date DESC
            `, [r.car_id || null, r.bike_id || null]),
            pool.query(`
                SELECT * FROM payment_info
                WHERE booking_id = $1 AND (payment_for ILIKE '%damage%' OR payment_for ILIKE '%repair%')
            `, [r.booking_id]),
            pool.query(`
                SELECT COUNT(*) as total_reports
                FROM damage_reports
                WHERE reported_by = $1
            `, [r.reported_by])
        ]);

        res.json({
            report: r,
            history: history.rows,
            payments: payments.rows,
            reporterStats: reporterStats.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateDamageStatus = async (req, res) => {
    const { id } = req.params;
    const { status, estimated_cost, admin_notes } = req.body;
    try {
        const statusMap = { 'Open': 'Pending', 'Under Review': 'On-Review', 'Resolved': 'Resolved' };
        const dbStatus = statusMap[status] || status;

        await pool.query(`
            UPDATE damage_reports
            SET status = $1, estimated_cost = $2, description = COALESCE(description, '') || '\nAdmin Note: ' || $3
            WHERE damage_id = $4
        `, [dbStatus, estimated_cost, admin_notes || '', id]);

        res.json({ message: `Damage report status updated to ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getDamageAnalytics = async (req, res) => {
    try {
        const reportsOverTime = await pool.query(`
            SELECT
                TO_CHAR(report_date, 'Mon YYYY') as month,
                COUNT(*) FILTER (WHERE severity = 'Low') as minor,
                COUNT(*) FILTER (WHERE severity = 'Medium') as moderate,
                COUNT(*) FILTER (WHERE severity = 'High') as severe,
                MIN(report_date) as sort_date
            FROM damage_reports
            WHERE report_date > CURRENT_DATE - INTERVAL '12 months'
            GROUP BY month
            ORDER BY sort_date ASC
        `);

        const severityDist = await pool.query(`
            SELECT severity, COUNT(*) as count
            FROM damage_reports
            GROUP BY severity
        `);

        const statusDist = await pool.query(`
            SELECT status, COUNT(*) as count
            FROM damage_reports
            GROUP BY status
        `);

        const topDamageTypes = await pool.query(`
            SELECT damage_type, COUNT(*) as count
            FROM damage_reports
            GROUP BY damage_type
            ORDER BY count DESC
            LIMIT 10
        `);

        const mostDamagedVehicles = await pool.query(`
            SELECT
                COALESCE(c.brand, b.brand) || ' ' || COALESCE(c.model, b.model) as vehicle,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE dr.severity = 'High') as severe_count
            FROM damage_reports dr
            LEFT JOIN cars c ON dr.car_id = c.car_id
            LEFT JOIN bikes b ON dr.bike_id = b.bike_id
            GROUP BY vehicle
            ORDER BY count DESC
            LIMIT 10
        `);

        const costDist = await pool.query(`
            SELECT
                CASE
                    WHEN estimated_cost < 5000 THEN 'Under 5K'
                    WHEN estimated_cost BETWEEN 5000 AND 20000 THEN '5K–20K'
                    WHEN estimated_cost BETWEEN 20000 AND 50000 THEN '20K–50K'
                    ELSE 'Above 50K'
                END as range,
                COUNT(*) as count
            FROM damage_reports
            WHERE estimated_cost > 0
            GROUP BY range
        `);

        const agencyDamage = await pool.query(`
            SELECT a.agency_name, COUNT(*) as count
            FROM damage_reports dr
            LEFT JOIN cars c ON dr.car_id = c.car_id
            LEFT JOIN bikes b ON dr.bike_id = b.bike_id
            JOIN agencies a ON COALESCE(c.agency_id, b.agency_id) = a.agency_id
            GROUP BY a.agency_name
            ORDER BY count DESC
            LIMIT 10
        `);

        const resolutionTime = await pool.query(`
            SELECT
                severity,
                AVG(CURRENT_DATE - report_date) as avg_days
            FROM damage_reports
            WHERE status = 'Resolved'
            GROUP BY severity
        `);

        res.json({
            reportsOverTime: reportsOverTime.rows,
            severityDist: severityDist.rows,
            statusDist: statusDist.rows,
            topDamageTypes: topDamageTypes.rows,
            mostDamagedVehicles: mostDamagedVehicles.rows,
            costDist: costDist.rows,
            agencyDamage: agencyDamage.rows,
            resolutionTime: resolutionTime.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getDamageStats,
    getDamageReports,
    getDamageDetail,
    updateDamageStatus,
    getDamageAnalytics
};
