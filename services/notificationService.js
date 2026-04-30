const Mailjet = require('node-mailjet');
const pool = require('../config/db');
const { generateNotificationId } = require('../controllers/createIDs');
require('dotenv').config();

const mailjet = Mailjet.apiConnect(
    process.env.GOCAR_MJ_APIKEY_PUBLIC,
    process.env.GOCAR_MJ_APIKEY_PRIVATE
);

/**
 * Send an email using Mailjet
 */
const sendEmail = async (toEmail, toName, subject, textPart, htmlPart) => {
    try {
        await mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [
                {
                    From: {
                        Email: process.env.GOCAR_FROM_EMAIL,
                        Name: process.env.GOCAR_FROM_NAME
                    },
                    To: [
                        {
                            Email: toEmail,
                            Name: toName
                        }
                    ],
                    Subject: subject,
                    TextPart: textPart,
                    HTMLPart: htmlPart
                }
            ]
        });
        console.log(`Email sent to ${toEmail}`);
    } catch (error) {
        console.error('Mailjet Error:', error.body || error);
    }
};

/**
 * Create a notification in the database
 */
const createNotification = async (userId, message) => {
    const notif_id = generateNotificationId();
    const query = `
        INSERT INTO notifications (notif_id, user_id, message, created_at, is_read)
        VALUES ($1, $2, $3, NOW(), false)
    `;
    try {
        await pool.query(query, [notif_id, userId, message]);
        console.log(`Notification created for user ${userId}`);
    } catch (error) {
        console.error('Notification Error:', error.message);
    }
};

/**
 * Orchestrate booking notifications for agency and driver
 */
const sendBookingNotification = async (bookingData) => {
    const { vehicle_id, driver_id, booking_id, start_ts, end_ts } = bookingData;

    try {
        // Fetch details of agency owner and driver
        const query = `
            SELECT 
                ag.owner_id as agency_owner_id, 
                ag.email as agency_email, 
                ag.agency_name,
                d.email as driver_email,
                d.name as driver_name,
                v.brand,
                v.model
            FROM (
                SELECT car_id as id, agency_id, brand, model FROM cars 
                UNION ALL 
                SELECT bike_id as id, agency_id, brand, model FROM bikes
            ) v
            JOIN agencies ag ON v.agency_id = ag.agency_id
            LEFT JOIN driver_info d ON d.driver_id = $2
            WHERE v.id = $1
        `;
        
        const result = await pool.query(query, [vehicle_id, driver_id]);
        if (result.rowCount === 0) return;

        const info = result.rows[0];
        const bookingPeriod = `${new Date(start_ts).toLocaleString()} to ${new Date(end_ts).toLocaleString()}`;

        // 1. Notify Agency
        const agencyMessage = `New booking request for ${info.brand} ${info.model} (ID: ${booking_id}). Period: ${bookingPeriod}`;
        await createNotification(info.agency_owner_id, agencyMessage);
        await sendEmail(
            info.agency_email,
            info.agency_name,
            'New Booking Request - goCar',
            agencyMessage,
            `<h3>New Booking Request</h3>
             <p>You have received a new booking request for <strong>${info.brand} ${info.model}</strong>.</p>
             <p><strong>Booking ID:</strong> ${booking_id}</p>
             <p><strong>Period:</strong> ${bookingPeriod}</p>
             <p>Please log in to your dashboard to manage this booking.</p>`
        );

        // 2. Notify Driver (if selected)
        if (driver_id && info.driver_email) {
            const driverMessage = `You have been assigned to a new booking request (ID: ${booking_id}). Period: ${bookingPeriod}`;
            // Note: Since notifications table requires user_id (FK to users), and drivers might not be in users table,
            // we only send email for now unless the schema is updated or drivers are also users.
            // If they are in users, we can try to find their user_id.
            
            await sendEmail(
                info.driver_email,
                info.driver_name,
                'New Driving Assignment - goCar',
                driverMessage,
                `<h3>New Driving Assignment</h3>
                 <p>Hello ${info.driver_name},</p>
                 <p>You have been selected as the driver for a new booking request.</p>
                 <p><strong>Booking ID:</strong> ${booking_id}</p>
                 <p><strong>Period:</strong> ${bookingPeriod}</p>
                 <p>Safe driving!</p>`
            );
        }

    } catch (error) {
        console.error('Error in sendBookingNotification:', error);
    }
};

module.exports = { sendEmail, createNotification, sendBookingNotification };
