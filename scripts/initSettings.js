const pool = require('../config/db');

const initSettingsTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.admin_activity_log (
                log_id SERIAL PRIMARY KEY,
                admin_id VARCHAR(20) REFERENCES users(user_id),
                action_type VARCHAR(50), 
                entity_type VARCHAR(50), 
                entity_id VARCHAR(50),
                details JSONB,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                ip_address VARCHAR(45)
            );

            CREATE TABLE IF NOT EXISTS public.platform_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value JSONB,
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                updated_by VARCHAR(20) REFERENCES users(user_id)
            );

            INSERT INTO public.platform_settings (setting_key, setting_value) VALUES 
            ('general', '{"platform_name": "goCar", "support_email": "support@gocar.com", "support_phone": "+880123456789", "timezone": "Asia/Dhaka", "maintenance_mode": false}'),
            ('booking', '{"min_duration": 1, "max_duration": 168, "advance_booking_days": 30, "late_fee_rate": 500, "grace_period_mins": 30, "initial_payment_pct": 50}'),
            ('verification', '{"auto_approve_agencies": false, "auto_approve_vehicles": false, "license_required": true, "min_driver_experience": 2}'),
            ('rating', '{"min_rating_threshold": 3.5, "min_reviews_display": 5}')
            ON CONFLICT (setting_key) DO NOTHING;

            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"approvals": true, "bookings": true, "financial": true, "system": true}'::jsonb;
        `);
        console.log('Settings tables initialized successfully');
    } catch (err) {
        console.error('Error initializing settings tables:', err);
    }
};

initSettingsTables();
