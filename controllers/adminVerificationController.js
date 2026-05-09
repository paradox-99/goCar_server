const pool = require('../config/db');

const getVerificationStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM agencies WHERE status = 'pending') as pending_agencies,
                (SELECT COUNT(*) FROM driver_info WHERE verified = false) as pending_drivers,
                (SELECT COUNT(*) FROM cars WHERE verified = false) as pending_cars,
                (SELECT COUNT(*) FROM bikes WHERE verified = false) as pending_bikes,
                (
                    SELECT COUNT(*) 
                    FROM (
                        SELECT license_status FROM users WHERE license_status = 'Unverified'
                        UNION ALL
                        SELECT license_status FROM driver_info WHERE license_status = 'Unverified'
                    ) as combined_licenses
                ) as pending_licenses
        `;
        const result = await pool.query(statsQuery);
        const stats = result.rows[0];
        
        const totalPending = Object.values(stats).reduce((acc, curr) => acc + parseInt(curr), 0);
        
        res.json({
            ...stats,
            total_pending: totalPending
        });
    } catch (err) {
        console.error("Error in getVerificationStats:", err);
        res.status(500).json({ error: err.message });
    }
};

const getVerificationList = async (req, res) => {
    const { category, search, status, verified, startDate, endDate, page = 1, limit = 10, pendingOnly = 'true', sortBy = 'oldest' } = req.query;
    const offset = (page - 1) * limit;
    let query = '';
    let countQuery = '';
    let params = [];
    let whereClauses = [];

    switch (category) {
        case 'agencies':
            query = `
                SELECT ag.*, u.name as owner_name, u.email as owner_email, u.accountstatus as owner_status,
                       ad.city, ad.area, ad.postcode,
                       (SELECT COUNT(*) FROM cars WHERE agency_id = ag.agency_id) as car_count,
                       (SELECT COUNT(*) FROM bikes WHERE agency_id = ag.agency_id) as bike_count
                FROM agencies ag
                JOIN users u ON ag.owner_id = u.user_id
                JOIN address ad ON ag.address_id = ad.address_id
            `;
            countQuery = `SELECT COUNT(*) FROM agencies ag JOIN users u ON ag.owner_id = u.user_id JOIN address ad ON ag.address_id = ad.address_id`;
            
            if (pendingOnly === 'true') {
                whereClauses.push("ag.status = 'pending'");
            } else if (status && status !== 'All') {
                params.push(status);
                whereClauses.push(`ag.status = $${params.length}`);
            }

            if (search) {
                params.push(`%${search}%`);
                whereClauses.push(`(ag.agency_name ILIKE $${params.length} OR ag.email ILIKE $${params.length} OR ag.phone_number ILIKE $${params.length})`);
            }
            break;

        case 'drivers':
            query = `
                SELECT d.*, ag.agency_name
                FROM driver_info d
                LEFT JOIN agencies ag ON d.agency_id = ag.agency_id
            `;
            countQuery = `SELECT COUNT(*) FROM driver_info d`;
            
            if (pendingOnly === 'true') {
                whereClauses.push("d.verified = false");
            } else if (verified && verified !== 'All') {
                params.push(verified === 'Verified');
                whereClauses.push(`d.verified = $${params.length}`);
            }

            if (search) {
                params.push(`%${search}%`);
                whereClauses.push(`(d.name ILIKE $${params.length} OR d.email ILIKE $${params.length} OR d.phone ILIKE $${params.length})`);
            }
            break;

        case 'cars':
            query = `
                SELECT c.*, ag.agency_name, ag.verified as agency_verified,
                       cd.license_number as doc_license, cd.expire_date as doc_expiry, cd.insurance_number, cd.fitness_certificate
                FROM cars c
                LEFT JOIN agencies ag ON c.agency_id = ag.agency_id
                LEFT JOIN cars_documentation cd ON c.car_id = cd.car_id
            `;
            countQuery = `SELECT COUNT(*) FROM cars c`;

            if (pendingOnly === 'true') {
                whereClauses.push("c.verified = false");
            } else if (verified && verified !== 'All') {
                params.push(verified === 'Verified');
                whereClauses.push(`c.verified = $${params.length}`);
            }

            if (search) {
                params.push(`%${search}%`);
                whereClauses.push(`(c.brand ILIKE $${params.length} OR c.model ILIKE $${params.length} OR ag.agency_name ILIKE $${params.length})`);
            }
            break;

        case 'bikes':
            query = `
                SELECT b.*, ag.agency_name, ag.verified as agency_verified,
                       bd.license_number as doc_license, bd.expire_date as doc_expiry, bd.insurance_number, bd.fitness_certificate
                FROM bikes b
                LEFT JOIN agencies ag ON b.agency_id = ag.agency_id
                LEFT JOIN motorbike_documentation bd ON b.bike_id = bd.bike_id
            `;
            countQuery = `SELECT COUNT(*) FROM bikes b`;

            if (pendingOnly === 'true') {
                whereClauses.push("b.verified = false");
            } else if (verified && verified !== 'All') {
                params.push(verified === 'Verified');
                whereClauses.push(`b.verified = $${params.length}`);
            }

            if (search) {
                params.push(`%${search}%`);
                whereClauses.push(`(b.brand ILIKE $${params.length} OR b.model ILIKE $${params.length} OR ag.agency_name ILIKE $${params.length})`);
            }
            break;

        case 'licenses':
            query = `
                SELECT * FROM (
                    SELECT user_id as id, name, email, phone, photo, 'user' as type, license_number, license_status, expire_date, experience, accountstatus, created_at, NULL as agency_name
                    FROM users
                    UNION ALL
                    SELECT driver_id as id, name, email, phone, photo, 'driver' as type, license_number, license_status, expire_date, experience_year as experience, accountstatus, created_at, (SELECT agency_name FROM agencies WHERE agency_id = driver_info.agency_id) as agency_name
                    FROM driver_info
                ) as combined
            `;
            countQuery = `SELECT COUNT(*) FROM (
                SELECT license_status, name, email, phone, license_number FROM users
                UNION ALL
                SELECT license_status, name, email, phone, license_number FROM driver_info
            ) as combined`;

            if (pendingOnly === 'true') {
                whereClauses.push("license_status = 'Unverified'");
            } else if (status && status !== 'All') {
                const statusMap = { 'Pending': 'Unverified', 'Valid': 'Verified', 'Expired': 'Expired', 'Rejected': 'Rejected' };
                params.push(statusMap[status] || status);
                whereClauses.push(`license_status = $${params.length}`);
            }

            if (search) {
                params.push(`%${search}%`);
                whereClauses.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR license_number ILIKE $${params.length})`);
            }
            break;

        default:
            return res.status(400).json({ error: 'Invalid category' });
    }

    if (startDate && endDate) {
        params.push(startDate, endDate);
        whereClauses.push(`created_at BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    if (whereClauses.length > 0) {
        const whereStr = ' WHERE ' + whereClauses.join(' AND ');
        query += whereStr;
        countQuery += whereStr;
    }

    // Sorting
    if (sortBy === 'oldest') {
        query += ` ORDER BY created_at ASC`;
    } else {
        query += ` ORDER BY created_at DESC`;
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    try {
        const result = await pool.query(query, [...params, limit, offset]);
        const countRes = await pool.query(countQuery, params);
        res.json({
            data: result.rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error("Error in getVerificationList:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getVerificationStats,
    getVerificationList
};
