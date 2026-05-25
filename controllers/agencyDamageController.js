const pool = require('../config/db');
const { generateBookingId } = require('./createIDs');

// DB value maps
const STATUS_UI_TO_DB = { 'Open': 'Pending', 'Under Review': 'On-Review', 'Resolved': 'Resolved' };
const STATUS_DB_TO_UI = { 'Pending': 'Open', 'On-Review': 'Under Review', 'Resolved': 'Resolved' };
const SEV_UI_TO_DB = { 'Minor': 'Low', 'Moderate': 'Medium', 'Severe': 'High' };

const IS_PAID_SUBQ = `EXISTS (
    SELECT 1 FROM payment_info pi
    WHERE pi.booking_id = dr.booking_id
    AND (pi.payment_for ILIKE '%damage%' OR pi.payment_for ILIKE '%repair%')
)`;

// Shared FROM clause: LEFT JOIN both vehicles so queries work for cars AND bikes
const VEHICLE_JOINS = `
    LEFT JOIN cars c ON dr.car_id = c.car_id
    LEFT JOIN bikes b ON dr.bike_id = b.bike_id
`;
const AGENCY_FILTER = `COALESCE(c.agency_id, b.agency_id) = $1`;

const getAgencyDamageStats = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const statsQ = `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE dr.status = 'Pending')::int AS open_count,
                COUNT(*) FILTER (WHERE dr.status = 'On-Review')::int AS under_review_count,
                COUNT(*) FILTER (WHERE dr.status = 'Resolved')::int AS resolved_count,
                COUNT(*) FILTER (
                    WHERE (dr.estimated_cost > 0 OR dr.estimated_cost IS NOT NULL)
                    AND dr.estimated_cost > 0
                    AND NOT ${IS_PAID_SUBQ}
                )::int AS pending_payment_count,
                COALESCE((
                    SELECT SUM(pi2.amount)
                    FROM payment_info pi2
                    JOIN damage_reports dr2 ON pi2.booking_id = dr2.booking_id
                    LEFT JOIN cars c2 ON dr2.car_id = c2.car_id
                    LEFT JOIN bikes b2 ON dr2.bike_id = b2.bike_id
                    WHERE COALESCE(c2.agency_id, b2.agency_id) = $1
                    AND (pi2.payment_for ILIKE '%damage%' OR pi2.payment_for ILIKE '%repair%')
                ), 0) AS total_recovered,
                -- Banner data
                COUNT(*) FILTER (WHERE dr.severity = 'High' AND dr.status = 'Pending')::int AS severe_open,
                COUNT(*) FILTER (WHERE dr.status = 'On-Review' AND dr.report_date < CURRENT_DATE - INTERVAL '7 days')::int AS stale_review,
                COUNT(*) FILTER (
                    WHERE dr.estimated_cost > 0
                    AND NOT ${IS_PAID_SUBQ}
                )::int AS unpaid_charges,
                COUNT(*) FILTER (WHERE dr.estimated_cost IS NULL OR dr.estimated_cost = 0)::int AS missing_cost
            FROM damage_reports dr
            ${VEHICLE_JOINS}
            WHERE ${AGENCY_FILTER}
        `;
        const result = await pool.query(statsQ, [agencyId]);
        const s = result.rows[0];
        res.json({
            total: s.total,
            openCount: s.open_count,
            underReviewCount: s.under_review_count,
            resolvedCount: s.resolved_count,
            pendingPaymentCount: s.pending_payment_count,
            totalRecovered: parseFloat(s.total_recovered) || 0,
            severeOpen: s.severe_open,
            staleReview: s.stale_review,
            unpaidCharges: s.unpaid_charges,
            missingCost: s.missing_cost
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getAgencyDamageList = async (req, res) => {
    const { agencyId } = req.params;
    const {
        search = '', status = '', severity = '', damage_type = '', car_id = '',
        payment_status = '', startDate = '', endDate = '', costRange = '',
        quickFilter = '', page = 0, limit = 10, sortBy = 'priority'
    } = req.query;
    const offset = parseInt(page) * parseInt(limit);

    const params = [agencyId];
    const where = [`COALESCE(c.agency_id, b.agency_id) = $1`];

    if (search) {
        params.push(`%${search}%`);
        where.push(`(dr.damage_id ILIKE $${params.length} OR dr.booking_id ILIKE $${params.length} OR COALESCE(c.brand, b.brand) ILIKE $${params.length} OR COALESCE(c.model, b.model) ILIKE $${params.length} OR cu.name ILIKE $${params.length})`);
    }
    if (status && status !== 'All') {
        params.push(STATUS_UI_TO_DB[status] || status);
        where.push(`dr.status = $${params.length}`);
    }
    if (severity && severity !== 'All') {
        params.push(SEV_UI_TO_DB[severity] || severity);
        where.push(`dr.severity = $${params.length}`);
    }
    if (damage_type && damage_type !== 'All') {
        params.push(damage_type);
        where.push(`dr.damage_type = $${params.length}`);
    }
    if (car_id && car_id !== 'All') {
        params.push(car_id);
        where.push(`(dr.car_id = $${params.length} OR dr.bike_id = $${params.length})`);
    }
    if (payment_status === 'Paid') {
        where.push(`${IS_PAID_SUBQ}`);
    } else if (payment_status === 'Pending Payment') {
        where.push(`dr.estimated_cost > 0 AND NOT ${IS_PAID_SUBQ}`);
    } else if (payment_status === 'No Cost Set') {
        where.push(`(dr.estimated_cost IS NULL OR dr.estimated_cost = 0)`);
    }
    if (startDate) { params.push(startDate); where.push(`dr.report_date >= $${params.length}`); }
    if (endDate) { params.push(endDate); where.push(`dr.report_date <= $${params.length}`); }
    if (costRange === 'No Estimate') { where.push(`(dr.estimated_cost IS NULL OR dr.estimated_cost = 0)`); }
    else if (costRange === 'Under 5000') { where.push(`dr.estimated_cost > 0 AND dr.estimated_cost < 5000`); }
    else if (costRange === '5000-20000') { where.push(`dr.estimated_cost BETWEEN 5000 AND 20000`); }
    else if (costRange === '20000-50000') { where.push(`dr.estimated_cost BETWEEN 20000 AND 50000`); }
    else if (costRange === 'Above 50000') { where.push(`dr.estimated_cost > 50000`); }

    // Quick filters
    if (quickFilter === 'open') { where.push(`dr.status = 'Pending'`); }
    else if (quickFilter === 'under_review') { where.push(`dr.status = 'On-Review'`); }
    else if (quickFilter === 'resolved') { where.push(`dr.status = 'Resolved'`); }
    else if (quickFilter === 'severe') { where.push(`dr.severity = 'High'`); }
    else if (quickFilter === 'moderate') { where.push(`dr.severity = 'Medium'`); }
    else if (quickFilter === 'minor') { where.push(`dr.severity = 'Low'`); }
    else if (quickFilter === 'pending_payment') { where.push(`dr.estimated_cost > 0 AND NOT ${IS_PAID_SUBQ}`); }
    else if (quickFilter === 'paid') { where.push(`${IS_PAID_SUBQ}`); }
    else if (quickFilter === 'missing_cost') { where.push(`(dr.estimated_cost IS NULL OR dr.estimated_cost = 0)`); }
    else if (quickFilter === 'week') { where.push(`dr.report_date >= CURRENT_DATE - INTERVAL '7 days'`); }
    else if (quickFilter === 'month') { where.push(`dr.report_date >= CURRENT_DATE - INTERVAL '30 days'`); }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const orderSql = sortBy === 'priority' ? `
        ORDER BY
            CASE
                WHEN dr.severity = 'High' AND dr.status = 'Pending' THEN 1
                WHEN dr.severity = 'Medium' AND dr.status = 'Pending' THEN 2
                WHEN dr.severity = 'Low' AND dr.status = 'Pending' THEN 3
                WHEN dr.severity = 'High' AND dr.status = 'On-Review' THEN 4
                WHEN dr.severity = 'Medium' AND dr.status = 'On-Review' THEN 5
                WHEN dr.severity = 'Low' AND dr.status = 'On-Review' THEN 6
                WHEN dr.status = 'Resolved' AND NOT ${IS_PAID_SUBQ} THEN 7
                ELSE 8
            END, dr.report_date ASC
    ` : sortBy === 'newest' ? `ORDER BY dr.report_date DESC`
      : sortBy === 'oldest' ? `ORDER BY dr.report_date ASC`
      : sortBy === 'cost_high' ? `ORDER BY dr.estimated_cost DESC NULLS LAST`
      : sortBy === 'cost_low' ? `ORDER BY dr.estimated_cost ASC NULLS LAST`
      : `ORDER BY dr.report_date DESC`;

    try {
        const listQ = `
            SELECT
                dr.*,
                COALESCE(c.brand, b.brand) AS brand,
                COALESCE(c.model, b.model) AS model,
                COALESCE(c.car_type, b.car_type) AS car_type,
                COALESCE(c.images[1], b.images[1]) AS car_image,
                bi.start_ts, bi.end_ts, bi.status AS booking_status,
                cu.name AS customer_name, cu.phone AS customer_phone, cu.photo AS customer_photo,
                (SELECT COUNT(*) FROM damage_reports dr2
                    WHERE (dr.car_id IS NOT NULL AND dr2.car_id = dr.car_id)
                       OR (dr.bike_id IS NOT NULL AND dr2.bike_id = dr.bike_id))::int AS vehicle_damage_count,
                ${IS_PAID_SUBQ} AS is_paid
            FROM damage_reports dr
            ${VEHICLE_JOINS}
            JOIN booking_info bi ON dr.booking_id = bi.booking_id
            JOIN users cu ON bi.user_id = cu.user_id
            ${whereSql}
            ${orderSql}
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const countQ = `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE dr.severity = 'High')::int AS severe_count,
                COUNT(*) FILTER (WHERE dr.severity = 'Medium')::int AS moderate_count,
                COUNT(*) FILTER (WHERE dr.severity = 'Low')::int AS minor_count,
                COUNT(*) FILTER (WHERE dr.status = 'Pending')::int AS open_count,
                COUNT(*) FILTER (WHERE dr.status = 'On-Review')::int AS review_count,
                COUNT(*) FILTER (WHERE dr.status = 'Resolved')::int AS resolved_count,
                COALESCE(SUM(CASE WHEN NOT ${IS_PAID_SUBQ} AND dr.estimated_cost > 0 THEN dr.estimated_cost END), 0) AS outstanding
            FROM damage_reports dr
            ${VEHICLE_JOINS}
            JOIN booking_info bi ON dr.booking_id = bi.booking_id
            JOIN users cu ON bi.user_id = cu.user_id
            ${whereSql}
        `;

        const [listRes, countRes] = await Promise.all([
            pool.query(listQ, [...params, parseInt(limit), offset]),
            pool.query(countQ, params)
        ]);

        res.json({
            reports: listRes.rows,
            ...countRes.rows[0],
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getAgencyDamageDetail = async (req, res) => {
    const { damageId } = req.params;
    try {
        const reportQ = await pool.query(`
            SELECT
                dr.*,
                COALESCE(c.brand, b.brand) AS brand,
                COALESCE(c.model, b.model) AS model,
                COALESCE(c.car_type, b.car_type) AS car_type,
                c.build_year,
                COALESCE(c.images, b.images) AS images,
                COALESCE(c.status, b.status) AS car_status,
                COALESCE(c.rating, b.rating) AS car_rating,
                bi.start_ts, bi.end_ts, bi.status AS booking_status, bi.booking_purpose, bi.estimated_destination, bi.total_rent_hours,
                cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone, cu.accountstatus AS customer_status, cu.photo AS customer_photo,
                d.name AS driver_name, d.phone AS driver_phone, d.license_status AS driver_license_status,
                pi.pickup_time, pi.fuel_level AS pickup_fuel, pi.odometer_reading AS pickup_odometer, pi.pickup_notes,
                ri.return_time, ri.fuel_level AS return_fuel, ri.odometer_reading AS return_odometer,
                ri.late_fee, ri.fuel_charge, ri.cleaning_charge, ri.return_notes
            FROM damage_reports dr
            ${VEHICLE_JOINS}
            JOIN booking_info bi ON dr.booking_id = bi.booking_id
            JOIN users cu ON bi.user_id = cu.user_id
            LEFT JOIN driver_info d ON bi.driver_id = d.driver_id
            LEFT JOIN pickup_info pi ON bi.booking_id = pi.booking_id
            LEFT JOIN return_info ri ON bi.booking_id = ri.booking_id
            WHERE dr.damage_id = $1
        `, [damageId]);

        if (reportQ.rowCount === 0) return res.status(404).json({ message: 'Not found' });

        const r = reportQ.rows[0];

        const [historyRes, paymentsRes] = await Promise.all([
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
                ORDER BY date DESC
            `, [r.booking_id])
        ]);

        res.json({ report: r, history: historyRes.rows, payments: paymentsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateAgencyDamageReport = async (req, res) => {
    const { damageId } = req.params;
    const { status, estimated_cost, notes } = req.body;
    try {
        const dbStatus = STATUS_UI_TO_DB[status] || status;
        const updates = [];
        const params = [];

        if (status) { params.push(dbStatus); updates.push(`status = $${params.length}`); }
        if (estimated_cost !== undefined) { params.push(estimated_cost); updates.push(`estimated_cost = $${params.length}`); }
        if (notes) {
            params.push(`\nAgency Note: ${notes}`);
            updates.push(`description = COALESCE(description, '') || $${params.length}`);
        }

        if (updates.length === 0) return res.status(400).json({ message: 'Nothing to update' });

        params.push(damageId);
        await pool.query(`UPDATE damage_reports SET ${updates.join(', ')} WHERE damage_id = $${params.length}`, params);
        res.json({ message: 'Updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const bulkUpdateDamageStatus = async (req, res) => {
    const { damageIds, status, notes } = req.body;
    if (!damageIds?.length) return res.status(400).json({ message: 'No IDs provided' });
    const dbStatus = STATUS_UI_TO_DB[status] || status;
    try {
        const placeholders = damageIds.map((_, i) => `$${i + 3}`).join(', ');
        await pool.query(
            `UPDATE damage_reports SET status = $1, description = COALESCE(description,'') || $2 WHERE damage_id IN (${placeholders})`,
            [dbStatus, notes ? `\nAgency Note: ${notes}` : '', ...damageIds]
        );
        res.json({ message: `${damageIds.length} reports updated to ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const recordDamageCharge = async (req, res) => {
    const { damageId } = req.params;
    const { booking_id, amount, method_type, trx_id, payment_for, notes, also_resolve } = req.body;
    const paymentId = `PAY-${generateBookingId()}`;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO payment_info (payment_id, booking_id, date, amount, method_type, trx_id, payment_for)
             VALUES ($1, $2, now(), $3, $4, $5, $6)`,
            [paymentId, booking_id, amount, method_type, trx_id || null, payment_for || 'Damage charge']
        );
        if (also_resolve) {
            await client.query(
                `UPDATE damage_reports SET status = 'Resolved', description = COALESCE(description,'') || $1 WHERE damage_id = $2`,
                [notes ? `\nCharge note: ${notes}` : '', damageId]
            );
        }
        await client.query('COMMIT');
        res.status(201).json({ payment_id: paymentId, message: 'Charge recorded' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const getRepeatOffenderVehicles = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                vehicle_id, brand, model, car_type, car_image, vehicle_type,
                COUNT(damage_id)::int AS total_reports,
                COUNT(*) FILTER (WHERE severity = 'High')::int AS severe_count,
                COUNT(*) FILTER (WHERE severity = 'Medium')::int AS moderate_count,
                COUNT(*) FILTER (WHERE severity = 'Low')::int AS minor_count,
                COALESCE(SUM(estimated_cost), 0) AS total_estimated_cost,
                MAX(report_date) AS last_report_date
            FROM (
                SELECT
                    c.car_id AS vehicle_id, c.brand, c.model, c.car_type, c.images[1] AS car_image, 'Car' AS vehicle_type,
                    dr.damage_id, dr.severity, dr.estimated_cost, dr.report_date, dr.booking_id
                FROM cars c
                JOIN damage_reports dr ON c.car_id = dr.car_id
                WHERE c.agency_id = $1
                UNION ALL
                SELECT
                    b.bike_id AS vehicle_id, b.brand, b.model, b.car_type, b.images[1] AS car_image, 'Bike' AS vehicle_type,
                    dr.damage_id, dr.severity, dr.estimated_cost, dr.report_date, dr.booking_id
                FROM bikes b
                JOIN damage_reports dr ON b.bike_id = dr.bike_id
                WHERE b.agency_id = $1
            ) combined
            GROUP BY vehicle_id, brand, model, car_type, car_image, vehicle_type
            HAVING COUNT(damage_id) > 1
            ORDER BY COUNT(damage_id) DESC
        `, [agencyId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getAgencyDamageFilterOptions = async (req, res) => {
    const { agencyId } = req.params;
    try {
        const [typesRes, vehiclesRes] = await Promise.all([
            pool.query(`
                SELECT DISTINCT dr.damage_type FROM damage_reports dr
                LEFT JOIN cars c ON dr.car_id = c.car_id
                LEFT JOIN bikes b ON dr.bike_id = b.bike_id
                WHERE COALESCE(c.agency_id, b.agency_id) = $1 AND dr.damage_type IS NOT NULL
                ORDER BY dr.damage_type
            `, [agencyId]),
            pool.query(`
                SELECT car_id AS vehicle_id, brand, model, car_type, 'Car' AS vehicle_type
                FROM cars WHERE agency_id = $1
                UNION ALL
                SELECT bike_id AS vehicle_id, brand, model, car_type, 'Bike' AS vehicle_type
                FROM bikes WHERE agency_id = $1
                ORDER BY brand, model
            `, [agencyId])
        ]);
        res.json({ damageTypes: typesRes.rows.map(r => r.damage_type), vehicles: vehiclesRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAgencyDamageStats,
    getAgencyDamageList,
    getAgencyDamageDetail,
    updateAgencyDamageReport,
    bulkUpdateDamageStatus,
    recordDamageCharge,
    getRepeatOffenderVehicles,
    getAgencyDamageFilterOptions
};
