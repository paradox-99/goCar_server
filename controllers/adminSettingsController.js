const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. My Profile
const getAdminProfile = async (req, res) => {
    try {
        const { id } = req.user; 
        const query = `
            SELECT u.*, a.city, a.area, a.postcode, a.latitude, a.longitude, a.display_name as address_display_name
            FROM users u
            LEFT JOIN address a ON u.address_id = a.address_id
            WHERE u.user_id = $1
        `;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Admin not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateAdminProfile = async (req, res) => {
    const { id } = req.user;
    const { name, phone, gender, dob, nid, photo, address } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Handle Address
        let address_id = req.body.address_id;
        if (address) {
            if (address_id) {
                await client.query(
                    'UPDATE address SET city=$1, area=$2, postcode=$3, display_name=$4 WHERE address_id=$5',
                    [address.city, address.area, address.postcode, address.display_name, address_id]
                );
            } else {
                address_id = `ADDR${Date.now()}`;
                await client.query(
                    'INSERT INTO address (address_id, city, area, postcode, display_name, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [address_id, address.city, address.area, address.postcode, address.display_name, address.latitude || 0, address.longitude || 0]
                );
            }
        }

        const updateQuery = `
            UPDATE users 
            SET name=$1, phone=$2, gender=$3, dob=$4, nid=$5, photo=$6, address_id=$7
            WHERE user_id=$8
            RETURNING *
        `;
        const result = await client.query(updateQuery, [name, phone, gender, dob, nid, photo, address_id, id]);
        
        await client.query('COMMIT');
        res.json({ message: 'Profile updated successfully', user: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// 2. Security
const updatePassword = async (req, res) => {
    const { id } = req.user;
    const { currentPassword, newPassword } = req.body;
    try {
        const userRes = await pool.query('SELECT password FROM users WHERE user_id = $1', [id]);
        const user = userRes.rows[0];
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [hashedPassword, id]);
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// 3. Notification Preferences
const updateNotificationPreferences = async (req, res) => {
    const { id } = req.user;
    const { preferences } = req.body;
    try {
        await pool.query('UPDATE users SET notification_preferences = $1 WHERE user_id = $2', [preferences, id]);
        res.json({ message: 'Preferences saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// 4. Activity Log
const getActivityLog = async (req, res) => {
    const { action_type, entity_type, startDate, endDate, search, page = 0, limit = 10 } = req.query;
    const offset = page * limit;
    let params = [];
    let whereClauses = [];

    if (action_type && action_type !== 'All') {
        params.push(action_type);
        whereClauses.push(`action_type = $${params.length}`);
    }
    if (entity_type && entity_type !== 'All') {
        params.push(entity_type);
        whereClauses.push(`entity_type = $${params.length}`);
    }
    if (startDate && endDate) {
        params.push(startDate, endDate);
        whereClauses.push(`timestamp BETWEEN $${params.length - 1} AND $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        whereClauses.push(`(entity_id ILIKE $${params.length} OR details::text ILIKE $${params.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    try {
        const query = `
            SELECT * FROM admin_activity_log 
            ${whereSql}
            ORDER BY timestamp DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const countQuery = `SELECT COUNT(*) FROM admin_activity_log ${whereSql}`;
        
        const [logs, count] = await Promise.all([
            pool.query(query, [...params, limit, offset]),
            pool.query(countQuery, params)
        ]);

        res.json({
            logs: logs.rows,
            total: parseInt(count.rows[0].count)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// 5. Admin Management
const getAdmins = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT user_id, name, email, photo, userrole, accountstatus, verified, last_active, created_at
            FROM users 
            WHERE userrole = 'admin'
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateAdminRole = async (req, res) => {
    const { id } = req.params;
    const { userrole, accountstatus } = req.body;
    try {
        await pool.query('UPDATE users SET userrole = $1, accountstatus = $2 WHERE user_id = $3', [userrole, accountstatus, id]);
        res.json({ message: 'Admin updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// 6. Platform Settings
const getPlatformSettings = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM platform_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updatePlatformSettings = async (req, res) => {
    const { settings } = req.body; // { general: {...}, booking: {...}, ... }
    const { id } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const [key, value] of Object.entries(settings)) {
            await client.query(
                'INSERT INTO platform_settings (setting_key, setting_value, updated_by, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()',
                [key, value, id]
            );
        }
        await client.query('COMMIT');
        res.json({ message: 'Platform settings updated' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getAdminProfile,
    updateAdminProfile,
    updatePassword,
    updateNotificationPreferences,
    getActivityLog,
    getAdmins,
    updateAdminRole,
    getPlatformSettings,
    updatePlatformSettings
};
