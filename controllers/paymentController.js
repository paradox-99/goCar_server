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

module.exports = { makePayment, paymentSuccess, getPaymentInfo, paymentFail, getPaymentHistory };