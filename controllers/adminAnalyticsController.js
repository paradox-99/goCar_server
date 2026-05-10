const pool = require('../config/db');
const moment = require('moment');

const getRevenueAnalytics = async (req, res) => {
    const { startDate, endDate, comparisonStartDate, comparisonEndDate, comparisonEnabled } = req.query;
    
    try {
        // 1. KPI Cards
        const kpiQuery = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_revenue,
                COUNT(*) as total_transactions,
                MAX(amount) as highest_payment,
                COALESCE(AVG(amount), 0) as avg_revenue_per_booking
            FROM payment_info
            WHERE date BETWEEN $1 AND $2
        `;
        
        const pendingQuery = `
            SELECT COALESCE(SUM(total_cost), 0) as pending_revenue
            FROM booking_info
            WHERE final_payment = false AND status != 'Cancelled'
            AND booking_ts BETWEEN $1 AND $2
        `;

        const [kpiRes, pendingRes] = await Promise.all([
            pool.query(kpiQuery, [startDate, endDate]),
            pool.query(pendingQuery, [startDate, endDate])
        ]);

        let comparisonKpi = null;
        if (comparisonEnabled === 'true') {
            const compKpiRes = await pool.query(kpiQuery, [comparisonStartDate, comparisonEndDate]);
            comparisonKpi = compKpiRes.rows[0];
        }

        // 2. Revenue Over Time (Daily/Weekly/Monthly)
        // Default to Daily for now, frontend can request granularity
        const revenueOverTimeQuery = `
            SELECT 
                DATE_TRUNC('day', date) as date,
                SUM(amount) as revenue,
                COUNT(*) as transactions
            FROM payment_info
            WHERE date BETWEEN $1 AND $2
            GROUP BY 1
            ORDER BY 1
        `;
        const revenueOverTime = await pool.query(revenueOverTimeQuery, [startDate, endDate]);

        // 3. Revenue by Payment Method
        const paymentMethodQuery = `
            SELECT 
                method_type as name,
                SUM(amount) as value
            FROM payment_info
            WHERE date BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const paymentMethod = await pool.query(paymentMethodQuery, [startDate, endDate]);

        // 4. Revenue by Vehicle Type
        const vehicleTypeQuery = `
            SELECT 
                vehicle_type as name,
                SUM(p.amount) as value
            FROM booking_info b
            JOIN payment_info p ON b.booking_id = p.booking_id
            WHERE p.date BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const vehicleType = await pool.query(vehicleTypeQuery, [startDate, endDate]);

        // 5. Revenue by Payment Type
        const paymentTypeQuery = `
            SELECT 
                payment_for as name,
                SUM(amount) as value
            FROM payment_info
            WHERE date BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const paymentType = await pool.query(paymentTypeQuery, [startDate, endDate]);

        // 6. Revenue by Agency (Top 10)
        const agencyRevenueQuery = `
            SELECT 
                a.agency_name as name,
                SUM(p.amount) as value
            FROM payment_info p
            JOIN booking_info b ON p.booking_id = b.booking_id
            JOIN agencies a ON b.agency_id = a.agency_id
            WHERE p.date BETWEEN $1 AND $2
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const agencyRevenue = await pool.query(agencyRevenueQuery, [startDate, endDate]);

        // 7. Monthly Revenue Heatmap
        const heatmapQuery = `
            SELECT 
                DATE_TRUNC('day', date) as date,
                SUM(amount) as value
            FROM payment_info
            WHERE date BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const heatmap = await pool.query(heatmapQuery, [startDate, endDate]);

        // 8. Agency Breakdown Table
        const agencyTableQuery = `
            SELECT 
                a.agency_name,
                SUM(CASE WHEN b.vehicle_type = 'Car' THEN p.amount ELSE 0 END) as cars_revenue,
                SUM(CASE WHEN b.vehicle_type = 'Bike' THEN p.amount ELSE 0 END) as bikes_revenue,
                SUM(p.amount) as total_revenue,
                COUNT(p.payment_id) as transaction_count,
                AVG(p.amount) as avg_per_booking,
                (SUM(p.amount) * 100.0 / NULLIF((SELECT SUM(amount) FROM payment_info WHERE date BETWEEN $1 AND $2), 0)) as percent_of_total
            FROM agencies a
            LEFT JOIN booking_info b ON a.agency_id = b.agency_id
            LEFT JOIN payment_info p ON b.booking_id = p.booking_id
            WHERE p.date BETWEEN $1 AND $2
            GROUP BY a.agency_name
            ORDER BY total_revenue DESC
        `;
        const agencyTable = await pool.query(agencyTableQuery, [startDate, endDate]);

        res.json({
            kpi: {
                ...kpiRes.rows[0],
                pending_revenue: pendingRes.rows[0].pending_revenue,
                comparison: comparisonKpi
            },
            revenueOverTime: revenueOverTime.rows,
            paymentMethod: paymentMethod.rows,
            vehicleType: vehicleType.rows,
            paymentType: paymentType.rows,
            agencyRevenue: agencyRevenue.rows,
            heatmap: heatmap.rows,
            agencyTable: agencyTable.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getBookingAnalytics = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const kpiQuery = `
            SELECT 
                COUNT(*) as total_bookings,
                COUNT(*) FILTER (WHERE status = 'Completed') as completed_bookings,
                COUNT(*) FILTER (WHERE status = 'Running') as ongoing_bookings,
                COUNT(*) FILTER (WHERE status = 'Requested') as pending_bookings,
                AVG(total_rent_hours) as avg_duration,
                COUNT(*) FILTER (WHERE driver_id IS NOT NULL) as with_driver_bookings
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2
        `;
        const kpi = await pool.query(kpiQuery, [startDate, endDate]);

        const bookingsOverTimeQuery = `
            SELECT 
                DATE_TRUNC('day', booking_ts) as date,
                status,
                COUNT(*) as count
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2
            GROUP BY 1, 2
            ORDER BY 1
        `;
        const bookingsOverTime = await pool.query(bookingsOverTimeQuery, [startDate, endDate]);

        const vehicleTypeQuery = `
            SELECT 
                vehicle_type as name,
                COUNT(*) as count
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const vehicleType = await pool.query(vehicleTypeQuery, [startDate, endDate]);

        const statusDistributionQuery = `
            SELECT status as name, COUNT(*) as value
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const statusDistribution = await pool.query(statusDistributionQuery, [startDate, endDate]);

        const peakHoursQuery = `
            SELECT 
                EXTRACT(DOW FROM booking_ts) as day,
                EXTRACT(HOUR FROM booking_ts) as hour,
                COUNT(*) as count
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2
            GROUP BY 1, 2
        `;
        const peakHours = await pool.query(peakHoursQuery, [startDate, endDate]);

        const popularCarsQuery = `
            SELECT 
                c.brand || ' ' || c.model as name,
                COUNT(b.booking_id) as value,
                c.rating
            FROM booking_info b
            JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
            WHERE b.booking_ts BETWEEN $1 AND $2
            GROUP BY c.car_id, c.brand, c.model, c.rating
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const popularCars = await pool.query(popularCarsQuery, [startDate, endDate]);

        const popularBikesQuery = `
            SELECT 
                b.brand || ' ' || b.model as name,
                COUNT(bi.booking_id) as value,
                b.rating
            FROM booking_info bi
            JOIN bikes b ON bi.vehicle_id = b.bike_id AND bi.vehicle_type = 'Bike'
            WHERE bi.booking_ts BETWEEN $1 AND $2
            GROUP BY b.bike_id, b.brand, b.model, b.rating
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const popularBikes = await pool.query(popularBikesQuery, [startDate, endDate]);

        const purposeDistributionQuery = `
            SELECT booking_purpose as name, COUNT(*) as value
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2 AND booking_purpose IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const purposeDistribution = await pool.query(purposeDistributionQuery, [startDate, endDate]);

        const durationDistributionQuery = `
            SELECT 
                CASE 
                    WHEN total_rent_hours <= 6 THEN '0-6 hrs'
                    WHEN total_rent_hours <= 12 THEN '6-12 hrs'
                    WHEN total_rent_hours <= 24 THEN '12-24 hrs'
                    WHEN total_rent_hours <= 72 THEN '1-3 days'
                    WHEN total_rent_hours <= 168 THEN '3-7 days'
                    ELSE '7+ days'
                END as range,
                COUNT(*) as count
            FROM booking_info
            WHERE booking_ts BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const durationDistribution = await pool.query(durationDistributionQuery, [startDate, endDate]);

        const agencySummaryQuery = `
            SELECT 
                a.agency_name,
                COUNT(b.booking_id) as total_bookings,
                COUNT(*) FILTER (WHERE b.status = 'Completed') as completed,
                COUNT(*) FILTER (WHERE b.status = 'Cancelled') as cancelled,
                COUNT(*) FILTER (WHERE b.status = 'Running') as ongoing,
                AVG(b.total_rent_hours) as avg_duration,
                (COUNT(*) FILTER (WHERE b.status = 'Completed') * 100.0 / NULLIF(COUNT(b.booking_id), 0)) as completion_rate
            FROM agencies a
            LEFT JOIN booking_info b ON a.agency_id = b.agency_id
            WHERE b.booking_ts BETWEEN $1 AND $2
            GROUP BY a.agency_name
        `;
        const agencySummary = await pool.query(agencySummaryQuery, [startDate, endDate]);

        res.json({
            kpi: kpi.rows[0],
            bookingsOverTime: bookingsOverTime.rows,
            vehicleType: vehicleType.rows,
            statusDistribution: statusDistribution.rows,
            peakHours: peakHours.rows,
            popularCars: popularCars.rows,
            popularBikes: popularBikes.rows,
            purposeDistribution: purposeDistribution.rows,
            durationDistribution: durationDistribution.rows,
            agencySummary: agencySummary.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getCancellationAnalytics = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const kpiQuery = `
            SELECT 
                COUNT(*) as total_cancellations,
                (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM booking_info WHERE booking_ts BETWEEN $1 AND $2)) as cancellation_rate,
                COUNT(*) FILTER (WHERE cancelled_by = 'User') as cancelled_by_user,
                COUNT(*) FILTER (WHERE cancelled_by = 'Agency') as cancelled_by_agency,
                COUNT(*) FILTER (WHERE cancelled_by = 'Admin') as cancelled_by_admin,
                SUM(total_cost) as revenue_lost
            FROM booking_info
            WHERE status = 'Cancelled' AND booking_ts BETWEEN $1 AND $2
        `;
        const kpi = await pool.query(kpiQuery, [startDate, endDate]);

        const reasonsQuery = `
            SELECT COALESCE(cancel_reason, 'No reason given') as name, COUNT(*) as value
            FROM booking_info
            WHERE status = 'Cancelled' AND booking_ts BETWEEN $1 AND $2
            GROUP BY 1
            ORDER BY 2 DESC
        `;
        const reasons = await pool.query(reasonsQuery, [startDate, endDate]);

        const timingQuery = `
            SELECT 
                CASE 
                    WHEN DATE_TRUNC('day', cancelled_at) = DATE_TRUNC('day', start_ts) THEN 'Same Day'
                    WHEN DATE_TRUNC('day', start_ts) - DATE_TRUNC('day', cancelled_at) = INTERVAL '1 day' THEN '1 Day Before'
                    WHEN DATE_TRUNC('day', start_ts) - DATE_TRUNC('day', cancelled_at) <= INTERVAL '3 days' THEN '2-3 Days Before'
                    WHEN DATE_TRUNC('day', start_ts) - DATE_TRUNC('day', cancelled_at) <= INTERVAL '7 days' THEN '4-7 Days Before'
                    ELSE '7+ Days Before'
                END as timing,
                COUNT(*) as count
            FROM booking_info
            WHERE status = 'Cancelled' AND booking_ts BETWEEN $1 AND $2
            GROUP BY 1
        `;
        const timing = await pool.query(timingQuery, [startDate, endDate]);

        const topUsersQuery = `
            SELECT u.name, COUNT(b.booking_id) as count,
            (COUNT(b.booking_id) * 100.0 / (SELECT COUNT(*) FROM booking_info WHERE user_id = u.user_id)) as cancel_rate
            FROM booking_info b
            JOIN users u ON b.user_id = u.user_id
            WHERE b.status = 'Cancelled' AND b.booking_ts BETWEEN $1 AND $2
            GROUP BY u.user_id, u.name
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const topUsers = await pool.query(topUsersQuery, [startDate, endDate]);

        const topAgenciesQuery = `
            SELECT a.agency_name, COUNT(b.booking_id) as count,
            (COUNT(b.booking_id) * 100.0 / (SELECT COUNT(*) FROM booking_info WHERE agency_id = a.agency_id)) as cancel_rate
            FROM booking_info b
            JOIN agencies a ON b.agency_id = a.agency_id
            WHERE b.status = 'Cancelled' AND b.booking_ts BETWEEN $1 AND $2
            GROUP BY a.agency_id, a.agency_name
            ORDER BY 2 DESC
            LIMIT 10
        `;
        const topAgencies = await pool.query(topAgenciesQuery, [startDate, endDate]);

        const detailTableQuery = `
            SELECT b.booking_id, u.name as customer, 
            COALESCE(c.brand || ' ' || c.model, bk.brand || ' ' || bk.model) as vehicle,
            a.agency_name as agency, b.cancelled_by, b.cancel_reason, b.cancelled_at,
            b.start_ts as scheduled_for, b.total_cost as revenue_lost
            FROM booking_info b
            JOIN users u ON b.user_id = u.user_id
            JOIN agencies a ON b.agency_id = a.agency_id
            LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
            LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
            WHERE b.status = 'Cancelled' AND b.booking_ts BETWEEN $1 AND $2
            ORDER BY b.cancelled_at DESC
        `;
        const detailTable = await pool.query(detailTableQuery, [startDate, endDate]);

        res.json({
            kpi: kpi.rows[0],
            reasons: reasons.rows,
            timing: timing.rows,
            topUsers: topUsers.rows,
            topAgencies: topAgencies.rows,
            detailTable: detailTable.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getDriverPerformance = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const kpiQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE accountstatus = 'Active') as active_drivers,
                AVG(rating) as avg_rating,
                (SELECT COUNT(*) FROM booking_info WHERE driver_id IS NOT NULL AND status = 'Completed' AND booking_ts BETWEEN $1 AND $2) as trips_completed
            FROM driver_info
        `;
        const kpi = await pool.query(kpiQuery, [startDate, endDate]);

        const ratingDistributionQuery = `
            SELECT ROUND(rating) as rating, COUNT(*) as count
            FROM driver_info
            GROUP BY 1 ORDER BY 1 DESC
        `;
        const ratingDistribution = await pool.query(ratingDistributionQuery);
        const topDriversTripsQuery = `
            SELECT d.name, COUNT(b.booking_id) as value, d.rating
            FROM booking_info b
            JOIN driver_info d ON b.driver_id = d.driver_id
            WHERE b.status = 'Completed' AND b.booking_ts BETWEEN $1 AND $2
            GROUP BY d.driver_id, d.name, d.rating
            ORDER BY 2 DESC
            LIMIT 15
        `;
        const topDriversTrips = await pool.query(topDriversTripsQuery, [startDate, endDate]);

        const topDriversEarningsQuery = `
            SELECT d.name, SUM(b.driver_cost) as value, COUNT(b.booking_id) as trips
            FROM booking_info b
            JOIN driver_info d ON b.driver_id = d.driver_id
            WHERE b.status = 'Completed' AND b.booking_ts BETWEEN $1 AND $2
            GROUP BY d.driver_id, d.name
            ORDER BY 2 DESC
            LIMIT 15
        `;
        const topDriversEarnings = await pool.query(topDriversEarningsQuery, [startDate, endDate]);

        const ratingTrendQuery = `
            SELECT 
                DATE_TRUNC('month', date) as month,
                AVG(rating) as rating
            FROM driver_reviews
            WHERE date BETWEEN $1 AND $2
            GROUP BY 1 ORDER BY 1
        `;
        const ratingTrend = await pool.query(ratingTrendQuery, [startDate, endDate]);

        const leaderboardQuery = `
            SELECT d.driver_id, d.name, a.agency_name,
            COUNT(b.booking_id) as total_trips,
            (COUNT(*) FILTER (WHERE b.status = 'Completed') * 100.0 / NULLIF(COUNT(b.booking_id), 0)) as completion_rate,
            d.rating, (SELECT COUNT(*) FROM driver_reviews WHERE driver_id = d.driver_id) as review_count,
            SUM(b.driver_cost) as total_earnings, d.availability
            FROM driver_info d
            LEFT JOIN agencies a ON d.agency_id = a.agency_id
            LEFT JOIN booking_info b ON d.driver_id = b.driver_id
            WHERE b.booking_ts BETWEEN $1 AND $2
            GROUP BY d.driver_id, d.name, a.agency_name, d.rating, d.availability
            ORDER BY total_trips DESC
        `;
        const leaderboard = await pool.query(leaderboardQuery, [startDate, endDate]);
        const availabilityQuery = `
            SELECT 
                CASE WHEN availability = true THEN 'Available' ELSE 'Busy' END as name, 
                COUNT(*) as value
            FROM driver_info
            GROUP BY 1
        `;
        const availability = await pool.query(availabilityQuery);

        res.json({
            kpi: kpi.rows[0],
            ratingDistribution: ratingDistribution.rows,
            topDriversTrips: topDriversTrips.rows,
            topDriversEarnings: topDriversEarnings.rows,
            ratingTrend: ratingTrend.rows,
            availability: availability.rows,
            leaderboard: leaderboard.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getAgencyPerformance = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const kpiQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE status = 'Active') as active_agencies,
                AVG(rating) as avg_rating,
                SUM(cars + bikes) as total_fleet
            FROM agencies
        `;
        const kpi = await pool.query(kpiQuery);

        const revenueComparisonQuery = `
            SELECT 
                a.agency_name as name,
                SUM(CASE WHEN b.vehicle_type = 'Car' THEN p.amount ELSE 0 END) as car_revenue,
                SUM(CASE WHEN b.vehicle_type = 'Bike' THEN p.amount ELSE 0 END) as bike_revenue
            FROM agencies a
            LEFT JOIN booking_info b ON a.agency_id = b.agency_id
            LEFT JOIN payment_info p ON b.booking_id = p.booking_id
            WHERE p.date BETWEEN $1 AND $2
            GROUP BY 1
            ORDER BY SUM(p.amount) DESC
            LIMIT 10
        `;
        const revenueComparison = await pool.query(revenueComparisonQuery, [startDate, endDate]);

        const ratingsComparisonQuery = `
            SELECT agency_name as name, rating, 
            (SELECT COUNT(*) FROM agency_reviews WHERE agency_id = agencies.agency_id) as review_count
            FROM agencies
            ORDER BY rating DESC
        `;
        const ratingsComparison = await pool.query(ratingsComparisonQuery);

        const growthTrendQuery = `
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as count
            FROM agencies
            GROUP BY 1 ORDER BY 1
        `;
        const growthTrend = await pool.query(growthTrendQuery);

        const statusDistributionQuery = `
            SELECT status as name, COUNT(*) as value
            FROM agencies
            GROUP BY 1
        `;
        const statusDistribution = await pool.query(statusDistributionQuery);

        const leaderboardQuery = `
            SELECT a.agency_id, a.agency_name, ad.city, (a.cars + a.bikes) as fleet_size,
            COUNT(b.booking_id) as total_bookings,
            (COUNT(*) FILTER (WHERE b.status = 'Completed') * 100.0 / NULLIF(COUNT(b.booking_id), 0)) as completion_rate,
            a.rating, (SELECT COUNT(*) FROM agency_reviews WHERE agency_id = a.agency_id) as review_count,
            SUM(p.amount) as total_revenue, a.status
            FROM agencies a
            LEFT JOIN address ad ON a.address_id = ad.address_id
            LEFT JOIN booking_info b ON a.agency_id = b.agency_id
            LEFT JOIN payment_info p ON b.booking_id = p.booking_id
            WHERE p.date BETWEEN $1 AND $2
            GROUP BY a.agency_id, a.agency_name, ad.city, a.rating, a.status
            ORDER BY total_revenue DESC
        `;
        const leaderboard = await pool.query(leaderboardQuery, [startDate, endDate]);

        res.json({
            kpi: kpi.rows[0],
            revenueComparison: revenueComparison.rows,
            ratingsComparison: ratingsComparison.rows,
            growthTrend: growthTrend.rows,
            statusDistribution: statusDistribution.rows,
            leaderboard: leaderboard.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const getVehiclePerformance = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const kpiQuery = `
            SELECT 
                (SELECT COUNT(*) FROM cars) + (SELECT COUNT(*) FROM bikes) as total_vehicles,
                (SELECT brand || ' ' || model FROM cars WHERE car_id = (SELECT vehicle_id FROM booking_info WHERE vehicle_type = 'Car' GROUP BY vehicle_id ORDER BY COUNT(*) DESC LIMIT 1)) as most_booked_car,
                (SELECT brand || ' ' || model FROM bikes WHERE bike_id = (SELECT vehicle_id FROM booking_info WHERE vehicle_type = 'Bike' GROUP BY vehicle_id ORDER BY COUNT(*) DESC LIMIT 1)) as most_booked_bike
        `;
        const kpi = await pool.query(kpiQuery);

        const carRankingQuery = `
            SELECT c.car_id, c.brand, c.model, c.images[1] as photo, ag.agency_name,
            COUNT(b.booking_id) as total_bookings, c.rating,
            (SELECT COUNT(*) FROM cars_reviews WHERE car_id = c.car_id) as review_count,
            SUM(p.amount) as total_revenue,
            (SELECT COUNT(*) FROM return_info ri JOIN booking_info bi ON ri.booking_id = bi.booking_id WHERE bi.vehicle_id = c.car_id AND bi.vehicle_type = 'Car' AND (ri.fuel_charge > 0 OR ri.cleaning_charge > 0)) as damage_reports,
            c.verified
            FROM cars c
            LEFT JOIN agencies ag ON c.agency_id = ag.agency_id
            LEFT JOIN booking_info b ON c.car_id = b.vehicle_id AND b.vehicle_type = 'Car'
            LEFT JOIN payment_info p ON b.booking_id = p.booking_id
            WHERE b.booking_ts BETWEEN $1 AND $2
            GROUP BY c.car_id, c.brand, c.model, c.images[1], ag.agency_name, c.rating, c.verified
            ORDER BY total_revenue DESC
        `;
        const carRanking = await pool.query(carRankingQuery, [startDate, endDate]);

        const bikeRankingQuery = `
            SELECT b.bike_id, b.brand, b.model, b.images[1] as photo, ag.agency_name,
            COUNT(bi.booking_id) as total_bookings, b.rating,
            (SELECT COUNT(*) FROM motorbike_reviews WHERE bike_id = b.bike_id) as review_count,
            SUM(p.amount) as total_revenue,
            (SELECT COUNT(*) FROM return_info ri JOIN booking_info bi ON ri.booking_id = bi.booking_id WHERE bi.vehicle_id = b.bike_id AND bi.vehicle_type = 'Bike' AND (ri.fuel_charge > 0 OR ri.cleaning_charge > 0)) as damage_reports,
            b.verified
            FROM bikes b
            LEFT JOIN agencies ag ON b.agency_id = ag.agency_id
            LEFT JOIN booking_info bi ON b.bike_id = bi.vehicle_id AND bi.vehicle_type = 'Bike'
            LEFT JOIN payment_info p ON bi.booking_id = p.booking_id
            WHERE bi.booking_ts BETWEEN $1 AND $2
            GROUP BY b.bike_id, b.brand, b.model, b.images[1], ag.agency_name, b.rating, b.verified
            ORDER BY total_revenue DESC
        `;
        const bikeRanking = await pool.query(bikeRankingQuery, [startDate, endDate]);

        const fuelTypeQuery = `
            SELECT fuel as name, COUNT(*) as value
            FROM (SELECT fuel FROM cars UNION ALL SELECT fuel FROM bikes) as combined
            GROUP BY 1
        `;
        const fuelType = await pool.query(fuelTypeQuery);

        const transmissionQuery = `
            SELECT transmission_type as name, COUNT(*) as value
            FROM cars
            GROUP BY 1
        `;
        const transmission = await pool.query(transmissionQuery);

        const damageAnalysisQuery = `
            SELECT COALESCE(c.brand || ' ' || c.model, b.brand || ' ' || b.model) as vehicle,
            'Late/Fuel/Clean' as severity, COUNT(*) as count
            FROM return_info rd
            JOIN booking_info bi ON rd.booking_id = bi.booking_id
            LEFT JOIN cars c ON bi.vehicle_id = c.car_id AND bi.vehicle_type = 'Car'
            LEFT JOIN bikes b ON bi.vehicle_id = b.bike_id AND bi.vehicle_type = 'Bike'
            WHERE rd.late_fee > 0 OR rd.fuel_charge > 0 OR rd.cleaning_charge > 0
            GROUP BY 1, 2
            ORDER BY count DESC
            LIMIT 10
        `;
        const damageAnalysis = await pool.query(damageAnalysisQuery);

        res.json({
            kpi: kpi.rows[0],
            carRanking: carRanking.rows,
            bikeRanking: bikeRanking.rows,
            fuelType: fuelType.rows,
            transmission: transmission.rows,
            damageAnalysis: damageAnalysis.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getRevenueAnalytics,
    getBookingAnalytics,
    getCancellationAnalytics,
    getDriverPerformance,
    getAgencyPerformance,
    getVehiclePerformance
};
