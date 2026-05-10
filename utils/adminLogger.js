const pool = require('../config/db');

/**
 * Log an admin action to the activity log table.
 * @param {string} admin_id - ID of the admin performing the action
 * @param {string} action_type - Type of action (e.g., Approved, Rejected, Deleted)
 * @param {string} entity_type - Type of entity affected (e.g., Agency, User, Car)
 * @param {string} entity_id - ID of the entity affected
 * @param {object} details - Additional details in JSON format
 * @param {string} ip_address - IP address of the admin
 */
const logAdminAction = async (admin_id, action_type, entity_type, entity_id, details, ip_address) => {
    try {
        const query = `
            INSERT INTO admin_activity_log 
            (admin_id, action_type, entity_type, entity_id, details, ip_address) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await pool.query(query, [admin_id, action_type, entity_type, entity_id, JSON.stringify(details), ip_address]);
    } catch (err) {
        console.error('Error logging admin action:', err);
    }
};

module.exports = { logAdminAction };
