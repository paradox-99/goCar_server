const pool = require('../config/db')
const SSLCommerzPayment = require('sslcommerz-lts');
const { generateTransactionId, generateBookingId, generatePaymentId } = require('./createIDs');

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox

const makePayment = async (req, res) => {
     let {
          user_id,
          vehicle_id,
          vehicle_type,
          start_ts,
          end_ts,
          total_rent_hours,
          total_cost,
          driver_cost,
          booking_purpose,
          estimated_destination,
          initial_cost,
          name,
          email,
          phone,
          address
     } = req.body;

     const amount = parseInt(initial_cost || total_cost || 0, 10);
     const tran_id = generateTransactionId();
     const booking_id = generateBookingId();

     const data = {
          total_amount: amount,
          currency: 'BDT',
          tran_id: tran_id, // use unique tran_id for each api call
          success_url: `http://localhost:3000/api/paymentRoutes/payment/success/${tran_id}?booking_id=${booking_id}`,
          fail_url: `http://localhost:3000/api/paymentRoutes/paymentFail/${tran_id}`,
          cancel_url: `http://localhost:3000/api/paymentRoutes/paymentFail/${tran_id}`,
          ipn_url: 'http://localhost:3030/ipn',
          shipping_method: 'NO',
          product_name: 'Rent',
          product_category: 'Rent',
          product_profile: 'Rent',
          cus_name: name,
          cus_email: email,
          cus_add1: address,
          cus_country: 'Bangladesh',
          cus_phone: phone
     };

     const client = await pool.connect();
     try {
          await client.query('BEGIN');
          await client.query(
               `INSERT INTO booking_info
               (booking_id, vehicle_type, vehicle_id, start_ts, end_ts, booking_ts, total_rent_hours, driver_cost, total_cost, initial_payment, final_payment, status, user_id, booking_purpose, estimated_destination)
               VALUES ($1,$2,$3,$4,$5,now(),$6,$7,$8,false,false,'pending',$9,$10,$11)`,
               [
                    booking_id,
                    (vehicle_type || 'car').toLowerCase(),
                    vehicle_id,
                    start_ts,
                    end_ts,
                    total_rent_hours,
                    driver_cost || 0,
                    total_cost,
                    user_id,
                    booking_purpose || 'N/A',
                    estimated_destination || 'N/A'
               ]
          );

          const paymentId = generatePaymentId();
          await client.query(
               `INSERT INTO payment_info (payment_id, booking_id, date, amount, method_type, trx_id, payment_for)
               VALUES ($1,$2,now(),$3,'card',$4,'initial')`,
               [paymentId, booking_id, amount, tran_id]
          );
          await client.query('COMMIT');

          const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
          const apiResponse = await sslcz.init(data);
          res.status(200).json({ url: apiResponse.GatewayPageURL, tran_id, booking_id, customer: { name, email, phone, address } });
     } catch (error) {
          await client.query('ROLLBACK');
          res.status(500).send(error.message);
     } finally {
          client.release();
     }
}

const paymentSuccess = async (req, res) => {
     const tran_id = req.params.trx_id;
     const bookingId = req.query.booking_id;
     const data = {
          tran_id: tran_id,
     }
     const url = `http://localhost:5173/payment/successful/${tran_id}`

     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
     sslcz.transactionQueryByTransactionId(data).then(async (apiResponse) => {
          if (apiResponse.no_of_trans_found === 1) {
               await pool.query(
                    `UPDATE booking_info
                     SET initial_payment = true, status = 'confirmed'
                     WHERE booking_id = $1`,
                    [bookingId]
               );
               return res.redirect(url);
          }
          return res.status(400).json({ message: 'Transaction not found' });
     }).catch((error) => res.status(500).send(error.message));
}

const getPaymentInfo = async (req, res) => {
     const tran_id = req.params.tran_id;
     const data = {
          tran_id: tran_id,
     }

     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
     sslcz.transactionQueryByTransactionId(data).then(async (apiResponse) => {
          if (apiResponse.no_of_trans_found === 1) {
               const paymentRow = await pool.query(
                    `SELECT payment_id, booking_id, amount, method_type, trx_id, date
                     FROM payment_info
                     WHERE trx_id = $1
                     ORDER BY date DESC
                     LIMIT 1`,
                    [tran_id]
               );
               return res.send({
                    gateway: apiResponse.element?.[0],
                    invoice: paymentRow.rows[0] || null
               });
          }
          return res.status(404).json({ message: 'No payment found' });
     }).catch((error) => res.status(500).send(error.message));
}

const paymentFail = async (req, res) => {
     const tran_id = req.params.tran_id;
     const url = `http://localhost:5173/payment/failed`

     res.redirect(url)
}

const getPaymentHistory = async (req, res) => {
     const query = `
          SELECT p.*, b.user_id, b.vehicle_id, b.vehicle_type, b.status AS booking_status
          FROM payment_info p
          JOIN booking_info b ON p.booking_id = b.booking_id
          ORDER BY p.date DESC
     `
     
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const makeExistingBookingPayment = async (req, res) => {
     let {
          booking_id,
          amount,
          name,
          email,
          phone,
          address
     } = req.body;

     const tran_id = generateTransactionId();

     const data = {
          total_amount: amount,
          currency: 'BDT',
          tran_id: tran_id,
          success_url: `http://localhost:3000/api/paymentRoutes/payment/success/${tran_id}?booking_id=${booking_id}`,
          fail_url: `http://localhost:3000/api/paymentRoutes/paymentFail/${tran_id}`,
          cancel_url: `http://localhost:3000/api/paymentRoutes/paymentFail/${tran_id}`,
          ipn_url: 'http://localhost:3030/ipn',
          shipping_method: 'NO',
          product_name: 'Rent Payment',
          product_category: 'Rent',
          product_profile: 'Rent',
          cus_name: name,
          cus_email: email,
          cus_add1: address,
          cus_country: 'Bangladesh',
          cus_phone: phone
     };

     try {
          const paymentId = generatePaymentId();
          await pool.query(
               `INSERT INTO payment_info (payment_id, booking_id, date, amount, method_type, trx_id, payment_for)
               VALUES ($1,$2,now(),$3,'card',$4,'initial')`,
               [paymentId, booking_id, amount, tran_id]
          );

          const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
          const apiResponse = await sslcz.init(data);
          res.status(200).json({ url: apiResponse.GatewayPageURL, tran_id, booking_id });
     } catch (error) {
          console.error("Error in existing booking payment:", error);
          res.status(500).send(error.message);
     }
}

const getAdminFilteredPayments = async (req, res) => {
    const { 
        search, method, payment_for, vehicle_type, 
        start_date, end_date, amount_range,
        page = 0, limit = 10 
    } = req.query;
    
    const offset = page * limit;
    let params = [];
    let whereClauses = [];

    if (search) {
        params.push(`%${search}%`);
        const pIdx = params.length;
        whereClauses.push(`(
            p.payment_id ILIKE $${pIdx} OR 
            p.booking_id ILIKE $${pIdx} OR 
            p.trx_id ILIKE $${pIdx} OR 
            u.name ILIKE $${pIdx} OR 
            u.phone ILIKE $${pIdx}
        )`);
    }

    if (method && method !== 'All') {
        params.push(method.toLowerCase());
        whereClauses.push(`p.method_type = $${params.length}`);
    }

    if (payment_for && payment_for !== 'All') {
        params.push(payment_for.toLowerCase().replace(' payment', ''));
        whereClauses.push(`p.payment_for ILIKE $${params.length}`);
    }

    if (vehicle_type && vehicle_type !== 'All') {
        params.push(vehicle_type);
        whereClauses.push(`b.vehicle_type = $${params.length}`);
    }

    if (start_date && end_date) {
        params.push(start_date, end_date);
        whereClauses.push(`p.date::date BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    if (amount_range && amount_range !== 'All') {
        if (amount_range === 'Under 1000') whereClauses.push(`p.amount < 1000`);
        else if (amount_range === '1000–5000') whereClauses.push(`p.amount BETWEEN 1000 AND 5000`);
        else if (amount_range === '5000–10000') whereClauses.push(`p.amount BETWEEN 5000 AND 10000`);
        else if (amount_range === 'Above 10000') whereClauses.push(`p.amount > 10000`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
        SELECT 
            p.*, 
            u.name as user_name, u.phone as user_phone,
            b.vehicle_type, b.vehicle_id, b.status as booking_status,
            COALESCE(c.brand, bk.brand) as brand, 
            COALESCE(c.model, bk.model) as model,
            ag.agency_name
        FROM payment_info p
        JOIN booking_info b ON p.booking_id = b.booking_id
        LEFT JOIN users u ON b.user_id = u.user_id
        LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
        LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
        LEFT JOIN agencies ag ON COALESCE(c.agency_id, bk.agency_id) = ag.agency_id
        ${whereSql}
        ORDER BY p.date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
        SELECT COUNT(*), SUM(p.amount) as subtotal
        FROM payment_info p
        JOIN booking_info b ON p.booking_id = b.booking_id
        LEFT JOIN users u ON b.user_id = u.user_id
        ${whereSql}
    `;

    try {
        const countRes = await pool.query(countQuery, params);
        const totalCount = parseInt(countRes.rows[0].count);
        const subtotal = parseInt(countRes.rows[0].subtotal || 0);
        const result = await pool.query(query, [...params, limit, offset]);

        res.json({
            payments: result.rows,
            totalCount,
            subtotal
        });
    } catch (error) {
        console.error("Error in getAdminFilteredPayments:", error);
        res.status(500).send(error.message);
    }
};

const getAdminPaymentStats = async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                SUM(amount) as total_revenue,
                SUM(CASE WHEN date::date = current_date THEN amount ELSE 0 END) as today_collection,
                SUM(CASE WHEN date_trunc('month', date) = date_trunc('month', current_date) THEN amount ELSE 0 END) as this_month_collection,
                COUNT(*) as total_transactions,
                (SELECT COUNT(*) FROM booking_info WHERE final_payment = false AND status != 'Cancelled') as pending_final,
                (SELECT COUNT(*) FROM booking_info WHERE initial_payment = false AND status != 'Cancelled') as pending_initial
            FROM payment_info
        `;
        const result = await pool.query(statsQuery);
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error in getAdminPaymentStats:", error);
        res.status(500).send(error.message);
    }
};

const getAdminPaymentDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                p.*, 
                b.vehicle_type, b.vehicle_id, b.status as booking_status, b.start_ts, b.end_ts, b.total_rent_hours, b.total_cost, b.initial_payment, b.final_payment,
                u.name as user_name, u.email as user_email, u.phone as user_phone, u.photo as user_photo, u.accountstatus as user_status,
                COALESCE(c.brand, bk.brand) as brand, COALESCE(c.model, bk.model) as model,
                ag.agency_name,
                pu.fuel_level as pickup_fuel, pu.odometer_reading as pickup_odo,
                ri.fuel_level as return_fuel, ri.odometer_reading as return_odo, ri.late_hours, ri.late_fee, ri.fuel_charge, ri.cleaning_charge,
                d.name as driver_name, d.rental_price as driver_rate
            FROM payment_info p
            JOIN booking_info b ON p.booking_id = b.booking_id
            LEFT JOIN users u ON b.user_id = u.user_id
            LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
            LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
            LEFT JOIN agencies ag ON COALESCE(c.agency_id, bk.agency_id) = ag.agency_id
            LEFT JOIN pickup_info pu ON b.booking_id = pu.booking_id
            LEFT JOIN return_info ri ON b.booking_id = ri.booking_id
            LEFT JOIN driver_info d ON b.driver_id = d.driver_id
            WHERE p.payment_id = $1
        `;
        const resDetail = await pool.query(query, [id]);
        if (resDetail.rowCount === 0) return res.status(404).json({ message: 'Payment not found' });

        const bookingId = resDetail.rows[0].booking_id;
        const allPayments = await pool.query(`SELECT * FROM payment_info WHERE booking_id = $1 ORDER BY date ASC`, [bookingId]);

        res.json({
            payment: resDetail.rows[0],
            all_booking_payments: allPayments.rows
        });
    } catch (error) {
        console.error("Error in getAdminPaymentDetails:", error);
        res.status(500).send(error.message);
    }
};

const getAdminRevenueAnalytics = async (req, res) => {
    try {
        const dailyRevenue = await pool.query(`
            SELECT date::date as day, SUM(amount) as revenue
            FROM payment_info
            WHERE date >= current_date - interval '30 days'
            GROUP BY day ORDER BY day ASC
        `);

        const methodBreakdown = await pool.query(`
            SELECT method_type, SUM(amount) as revenue, COUNT(*) as count
            FROM payment_info
            GROUP BY method_type
        `);

        const typeBreakdown = await pool.query(`
            SELECT payment_for, SUM(amount) as revenue, COUNT(*) as count
            FROM payment_info
            GROUP BY payment_for
        `);

        const monthlyTrend = await pool.query(`
            SELECT date_trunc('month', date) as month, SUM(amount) as revenue
            FROM payment_info
            WHERE date >= current_date - interval '12 months'
            GROUP BY month ORDER BY month ASC
        `);

        const topAgencies = await pool.query(`
            SELECT ag.agency_name, SUM(p.amount) as revenue
            FROM payment_info p
            JOIN booking_info b ON p.booking_id = b.booking_id
            JOIN agencies ag ON b.agency_id = ag.agency_id
            GROUP BY ag.agency_name ORDER BY revenue DESC LIMIT 5
        `);

        const topVehicles = await pool.query(`
            SELECT COALESCE(c.brand, bk.brand) || ' ' || COALESCE(c.model, bk.model) as vehicle_name, SUM(p.amount) as revenue
            FROM payment_info p
            JOIN booking_info b ON p.booking_id = b.booking_id
            LEFT JOIN cars c ON b.vehicle_id = c.car_id AND b.vehicle_type = 'Car'
            LEFT JOIN bikes bk ON b.vehicle_id = bk.bike_id AND b.vehicle_type = 'Bike'
            GROUP BY vehicle_name ORDER BY revenue DESC LIMIT 5
        `);

        res.json({
            dailyRevenue: dailyRevenue.rows,
            methodBreakdown: methodBreakdown.rows,
            typeBreakdown: typeBreakdown.rows,
            monthlyTrend: monthlyTrend.rows,
            topAgencies: topAgencies.rows,
            topVehicles: topVehicles.rows
        });
    } catch (error) {
        console.error("Error in getAdminRevenueAnalytics:", error);
        res.status(500).send(error.message);
    }
};

module.exports = { 
    makePayment, 
    makeExistingBookingPayment, 
    paymentSuccess, 
    getPaymentInfo, 
    paymentFail, 
    getPaymentHistory,
    getAdminFilteredPayments,
    getAdminPaymentStats,
    getAdminPaymentDetails,
    getAdminRevenueAnalytics
};