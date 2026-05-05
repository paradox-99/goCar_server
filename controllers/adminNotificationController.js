const pool = require('../config/db');
const { generateTransactionId } = require('./createIDs');

/**
 * Get overall notification stats for the admin dashboard
 */
const getAdminNotificationStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_sent,
                COUNT(*) FILTER (WHERE is_read = true) as read_count,
                COUNT(*) FILTER (WHERE is_read = false) as unread_count,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as sent_today,
                COUNT(DISTINCT user_id) as total_recipients
            FROM notifications
        `;

        const result = await pool.query(statsQuery);
        const stats = result.rows[0];

        const total = parseInt(stats.total_sent) || 0;
        const read = parseInt(stats.read_count) || 0;
        const unread = parseInt(stats.unread_count) || 0;

        res.json({
            totalSent: total,
            readCount: read,
            unreadCount: unread,
            sentToday: parseInt(stats.sent_today) || 0,
            totalRecipients: parseInt(stats.total_recipients) || 0,
            readRate: total > 0 ? Math.round((read / total) * 100) : 0,
            unreadRate: total > 0 ? Math.round((unread / total) * 100) : 0
        });
    } catch (error) {
        console.error('Error fetching admin notification stats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get paginated and filtered list of notifications
 */
const getAdminNotificationsList = async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        status, 
        role, 
        accountStatus, 
        quickFilter, 
        start, 
        end 
    } = req.query;
    
    const offset = (page - 1) * limit;
    let values = [];
    let whereClauses = [];

    // Base query with joins to user info
    let query = `
        SELECT n.*, u.name as user_name, u.email as user_email, u.photo as user_photo, 
               u.userrole, u.accountstatus, u.verified
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.user_id
    `;

    let countQuery = `
        SELECT COUNT(*) 
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.user_id
    `;

    // Filters
    if (search) {
        whereClauses.push(`(n.message ILIKE $${values.length + 1} OR u.name ILIKE $${values.length + 1} OR u.email ILIKE $${values.length + 1})`);
        values.push(`%${search}%`);
    }

    if (status && status !== 'All') {
        whereClauses.push(`n.is_read = $${values.length + 1}`);
        values.push(status === 'Read');
    }

    if (role && role !== 'All') {
        whereClauses.push(`u.userrole::text = $${values.length + 1}`);
        values.push(role);
    }

    if (accountStatus && accountStatus !== 'All') {
        whereClauses.push(`u.accountstatus::text = $${values.length + 1}`);
        values.push(accountStatus);
    }

    if (start) {
        whereClauses.push(`n.created_at >= $${values.length + 1}`);
        values.push(start);
    }

    if (end) {
        whereClauses.push(`n.created_at <= $${values.length + 1}::timestamp + interval '1 day'`);
        values.push(end);
    }

    if (quickFilter && quickFilter !== 'All') {
        if (quickFilter === 'Unread Only') whereClauses.push(`n.is_read = false`);
        else if (quickFilter === 'Read Only') whereClauses.push(`n.is_read = true`);
        else if (quickFilter === 'Sent Today') whereClauses.push(`n.created_at >= CURRENT_DATE`);
        else if (quickFilter === 'Sent This Week') whereClauses.push(`n.created_at >= CURRENT_DATE - interval '7 days'`);
        else if (quickFilter === 'Sent This Month') whereClauses.push(`n.created_at >= CURRENT_DATE - interval '30 days'`);
        else if (quickFilter === 'Broadcast') whereClauses.push(`n.category = 'broadcast'`);
        else if (quickFilter === 'Individual') whereClauses.push(`n.category = 'individual'`);
    }

    if (whereClauses.length > 0) {
        const whereString = ' WHERE ' + whereClauses.join(' AND ');
        query += whereString;
        countQuery += whereString;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    const finalValues = [...values, limit, offset];

    try {
        const listResult = await pool.query(query, finalValues);
        const countResult = await pool.query(countQuery, values);

        res.json({
            notifications: listResult.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Error fetching admin notifications list:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Send notification (Individual, Group, or Broadcast)
 */
const sendAdminNotification = async (req, res) => {
    const { type, recipientId, filters, message, category } = req.body;
    const batchId = `BATCH-${generateTransactionId()}`;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let targetUserIds = [];

        if (type === 'individual') {
            targetUserIds = [recipientId];
        } else if (type === 'group') {
            let groupQuery = `SELECT user_id, name FROM users WHERE 1=1`;
            let groupValues = [];

            if (filters.role && filters.role !== 'All') {
                groupQuery += ` AND userrole::text = $${groupValues.length + 1}`;
                groupValues.push(filters.role);
            }
            if (filters.status && filters.status !== 'All') {
                groupQuery += ` AND accountstatus::text = $${groupValues.length + 1}`;
                groupValues.push(filters.status);
            }
            if (filters.verified && filters.verified !== 'All') {
                groupQuery += ` AND verified = $${groupValues.length + 1}`;
                groupValues.push(filters.verified === 'Verified');
            }
            if (filters.license && filters.license !== 'All') {
                groupQuery += ` AND license_status::text = $${groupValues.length + 1}`;
                groupValues.push(filters.license);
            }

            const groupResult = await client.query(groupQuery, groupValues);
            targetUserIds = groupResult.rows.map(u => u.user_id);
        } else if (type === 'broadcast') {
            let broadcastQuery = `SELECT user_id FROM users`;
            if (req.body.excludeSuspended) {
                broadcastQuery += ` WHERE accountstatus::text = 'Active'`;
            }
            const broadcastResult = await client.query(broadcastQuery);
            targetUserIds = broadcastResult.rows.map(u => u.user_id);
        }

        if (targetUserIds.length === 0) {
            throw new Error('No recipients found for the selected criteria');
        }

        // Insert notifications in batches if many
        for (const userId of targetUserIds) {
            const notifId = `NOTIF-${generateTransactionId()}-${Math.random().toString(36).substr(2, 5)}`;
            
            // Handle template variables
            // For now, we'll fetch user name if needed or just simple replace
            // This is a bit inefficient for large broadcasts, but let's do it simply
            let finalMessage = message;
            if (message.includes('{user_name}')) {
                const userRes = await client.query('SELECT name FROM users WHERE user_id = $1', [userId]);
                const userName = userRes.rows[0]?.name || 'User';
                finalMessage = message.replace(/{user_name}/g, userName);
            }

            await client.query(
                `INSERT INTO notifications (notif_id, user_id, message, category, batch_id, created_at, is_read)
                 VALUES ($1, $2, $3, $4, $5, NOW(), false)`,
                [notifId, userId, finalMessage, type, batchId]
            );
        }

        await client.query('COMMIT');
        res.json({ 
            message: `Notification sent successfully to ${targetUserIds.length} recipient(s)`,
            recipientCount: targetUserIds.length
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending admin notification:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    } finally {
        client.release();
    }
};

/**
 * Delete individual or bulk notifications
 */
const deleteAdminNotifications = async (req, res) => {
    const { notificationIds } = req.body; // Array of IDs

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        return res.status(400).json({ message: 'No notification IDs provided' });
    }

    try {
        await pool.query(
            `DELETE FROM notifications WHERE notif_id = ANY($1)`,
            [notificationIds]
        );
        res.json({ message: 'Notifications deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin notifications:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get notification analytics
 */
const getAdminNotificationAnalytics = async (req, res) => {
    try {
        // 1. Sent per day (Last 30 days)
        const trendQuery = `
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM notifications
            WHERE created_at >= CURRENT_DATE - interval '30 days'
            GROUP BY day
            ORDER BY day ASC
        `;
        const trendResult = await pool.query(trendQuery);

        // 2. Read vs Unread
        const readUnreadQuery = `
            SELECT is_read, COUNT(*) as count
            FROM notifications
            GROUP BY is_read
        `;
        const readUnreadResult = await pool.query(readUnreadQuery);

        // 3. By Recipient Role
        const roleQuery = `
            SELECT u.userrole, COUNT(*) as count
            FROM notifications n
            JOIN users u ON n.user_id = u.user_id
            GROUP BY u.userrole
        `;
        const roleResult = await pool.query(roleQuery);

        // 4. Read Rate Trend (Last 12 months)
        const readRateTrendQuery = `
            SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
                   MIN(created_at) as sort_date,
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE is_read = true) as read
            FROM notifications
            WHERE created_at >= CURRENT_DATE - interval '12 months'
            GROUP BY month
            ORDER BY sort_date ASC
        `;
        const readRateTrendResult = await pool.query(readRateTrendQuery);

        // 5. Top 5 most notified users
        const topUsersQuery = `
            SELECT u.name, COUNT(*) as total,
                   COUNT(*) FILTER (WHERE is_read = true) as read
            FROM notifications n
            JOIN users u ON n.user_id = u.user_id
            GROUP BY u.name
            ORDER BY total DESC
            LIMIT 5
        `;
        const topUsersResult = await pool.query(topUsersQuery);

        res.json({
            sentTrend: trendResult.rows,
            readStatus: readUnreadResult.rows.map(r => ({
                name: r.is_read ? 'Read' : 'Unread',
                value: parseInt(r.count)
            })),
            roleDistribution: roleResult.rows,
            readRateTrend: readRateTrendResult.rows.map(r => ({
                month: r.month,
                rate: parseInt(r.total) > 0 ? Math.round((parseInt(r.read) / parseInt(r.total)) * 100) : 0
            })),
            topUsers: topUsersResult.rows.map(r => ({
                name: r.name,
                total: parseInt(r.total),
                readRate: parseInt(r.total) > 0 ? Math.round((parseInt(r.read) / parseInt(r.total)) * 100) : 0
            }))
        });
    } catch (error) {
        console.error('Error fetching notification analytics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Search users for individual selection
 */
const searchRecipients = async (req, res) => {
    const { query, showAll } = req.query;
    try {
        let sql = `
            SELECT user_id, name, email, phone, photo, userrole, accountstatus, verified
            FROM users
            WHERE (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
        `;
        if (!showAll) {
            sql += ` AND accountstatus::text = 'Active'`;
        }
        sql += ` LIMIT 10`;
        
        const result = await pool.query(sql, [`%${query}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching recipients:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getAdminNotificationStats,
    getAdminNotificationsList,
    sendAdminNotification,
    deleteAdminNotifications,
    getAdminNotificationAnalytics,
    searchRecipients
};
