const Mailjet = require('node-mailjet');
const pool = require('../config/db');
const { generateNotificationId } = require('../controllers/createIDs');
require('dotenv').config();

const mailjet = new Mailjet({
    apiKey: process.env.GOCAR_MJ_APIKEY_PUBLIC,
    apiSecret: process.env.GOCAR_MJ_APIKEY_PRIVATE
});

/**
 * Send an email using Mailjet (v6 syntax)
 */
const sendEmail = async (toEmail, toName, subject, textPart, htmlPart) => {
    try {
        const result = await mailjet
            .post("send", { version: 'v3.1' })
            .request({
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
        return result;
    } catch (error) {
        console.error('Mailjet Error:', error.message || error);
        throw error;
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

/**
 * Notify User about booking status update (Accept/Cancel)
 */
const sendStatusUpdateNotification = async (bookingId, newStatus) => {
    try {
        const query = `
            SELECT 
                bi.booking_id,
                bi.user_id,
                bi.start_ts,
                bi.end_ts,
                u.name as user_name,
                u.email as user_email,
                ag.agency_name,
                COALESCE(c.brand, b.brand) as brand,
                COALESCE(c.model, b.model) as model
            FROM booking_info bi
            JOIN users u ON bi.user_id = u.user_id
            LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND LOWER(bi.vehicle_type::text) = 'car'
            LEFT JOIN bikes b ON bi.vehicle_id = b.bike_id AND LOWER(bi.vehicle_type::text) = 'bike'
            JOIN agencies ag ON COALESCE(c.agency_id, b.agency_id) = ag.agency_id
            WHERE bi.booking_id = $1
        `;

        const result = await pool.query(query, [bookingId]);
        if (result.rowCount === 0) return;

        const info = result.rows[0];
        const statusText = newStatus === 'Confirmed' ? 'Accepted' : newStatus;
        const message = `Your booking for ${info.brand} ${info.model} (ID: ${info.booking_id}) has been ${statusText} by ${info.agency_name}.`;

        // 1. Database Notification
        await createNotification(info.user_id, message);

        // 2. Email Notification
        const subject = `Booking ${statusText} - goCar`;
        
        let paymentReminder = '';
        if (newStatus === 'Confirmed') {
            paymentReminder = `
                <div style="margin-top: 25px; padding: 20px; background-color: #fffaf0; border: 1px solid #ffeb3b; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #f58300;">💳 Action Required: Initial Payment</h4>
                    <p style="margin: 0; font-size: 14px; color: #555;">
                        To secure your booking, please pay the <strong>initial 50% payment</strong> from your dashboard. 
                        Once the payment is completed, your booking will be fully secured for the selected period.
                    </p>
                </div>
            `;
        }

        const htmlPart = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <div style="background-color: #f58300; padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 1px;">goCar</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">Status Update Notification</p>
                </div>
                
                <div style="padding: 30px; background-color: white;">
                    <h2 style="color: #333; margin-top: 0;">Hello ${info.user_name},</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        Your booking request for <strong>${info.brand} ${info.model}</strong> has been <span style="color: ${newStatus === 'Confirmed' ? '#4caf50' : '#f44336'}; font-weight: bold;">${statusText}</span> by <strong>${info.agency_name}</strong>.
                    </p>
                    
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #888; font-size: 14px; width: 40%;">Booking ID:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: 600;">${info.booking_id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #888; font-size: 14px;">Vehicle:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: 600;">${info.brand} ${info.model}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #888; font-size: 14px;">Pickup Time:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: 600;">${new Date(info.start_ts).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #888; font-size: 14px;">Return Time:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: 600;">${new Date(info.end_ts).toLocaleString()}</td>
                            </tr>
                        </table>
                    </div>

                    ${paymentReminder}

                    <div style="margin-top: 35px; text-align: center;">
                        <a href="http://localhost:5173/dashboard/user/bookings" style="background-color: #f58300; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">View Booking on Dashboard</a>
                    </div>
                </div>
                
                <div style="background-color: #f1f1f1; padding: 20px; text-align: center; color: #888; font-size: 12px;">
                    <p style="margin: 0;">&copy; 2026 goCar Rental Service. All rights reserved.</p>
                    <p style="margin: 5px 0 0 0;">This is an automated email, please do not reply.</p>
                </div>
            </div>
        `;

        await sendEmail(info.user_email, info.user_name, subject, message, htmlPart);

    } catch (error) {
        console.error('Error in sendStatusUpdateNotification:', error);
    }
};

module.exports = { sendEmail, createNotification, sendBookingNotification, sendStatusUpdateNotification };
