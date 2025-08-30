const connectDB = require('../config/db')
const SSLCommerzPayment = require('sslcommerz-lts');
const { generateTransactionId, generateBookingId, generatePaymentId } = require('./createIDs');

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox

let booking_id = '';
let payment_id = '';

const makePayment = async (req, res) => {
     let { driver_cost, pickup_date, dropoff_date, total_cost, initial_cost, total_rent_hours, user_id, name, email, phone, address, vehicle_id } = req.body;
     let amount = parseInt(initial_cost);
     let total = parseInt(total_cost);
     let remaining_cost = total - amount;
     total_rent_hours = parseInt(total_rent_hours);

     console.log(email);
     

     const tran_id = generateTransactionId();
     booking_id = generateBookingId();

     const data = {
          total_amount: amount,
          currency: 'BDT',
          tran_id: tran_id, // use unique tran_id for each api call
          success_url: `http://localhost:3000/api/paymentRoutes/payment/success/${tran_id}`,
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
     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
     sslcz.init(data).then(apiResponse => {
          let GatewayPageURL = apiResponse.GatewayPageURL
          const query = `
               INSERT INTO booking_info (booking_id, driver_cost, dropoff_date, pickup_date, remaining_amount, total_cost, total_rent_hours, user_id, vehicle_id)
               VALUES ('${booking_id}', '${driver_cost}', '${dropoff_date}', '${pickup_date}', '${remaining_cost}', '${total}', '${total_rent_hours}', '${user_id}', '${vehicle_id}')
          `;

          connectDB.query(query, (err, result) => {
               if (err) {
                    console.log('fetching error: ', err);
                    return res.status(500).json({ error: 'Failed to retrieve users' });
               }
          })
          res.send({ url: GatewayPageURL })
     });
}

const paymentSuccess = async (req, res) => {
     const tran_id = req.params.trx_id;
     const data = {
          tran_id: tran_id,
     }
     const url = `http://localhost:5173/payment/successful/${tran_id}`
     payment_id = generatePaymentId();

     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
     sslcz.transactionQueryByTransactionId(data).then(apiResponse => {
          if (apiResponse.no_of_trans_found === 1) {
               const query = `
                    INSERT INTO payment_info (payment_id, Trx_id, paid_amount, payment_method)
                    VALUES ('${payment_id}', '${tran_id}', ${apiResponse.element[0].amount}, '${apiResponse.element[0].bank_gw}');
               `;

               connectDB.query(query, (err, result) => {
                    if (err) {
                         console.log('fetching error: ', err);
                         return res.status(500).json({ error: 'Failed to retrieve users' });
                    }
               })

               res.redirect(url);
          }
     });
}

const getPaymentInfo = async (req, res) => {
     const tran_id = req.params.tran_id;
     const data = {
          tran_id: tran_id,
     }

     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
     sslcz.transactionQueryByTransactionId(data).then(apiResponse => {
          if (apiResponse.no_of_trans_found === 1) {
               const paymentInfo = apiResponse.element;

               const query = `
                         INSERT INTO booing_payment (booking_id, payment_id, payment_date)
                         VALUES ('${booking_id}', '${payment_id}', '${apiResponse.element[0].tran_date}')
                    `;

               connectDB.query(query, (err, result) => {
                    if (err) {
                         console.log('fetching error: ', err);
                         return res.status(500).json({ error: 'Failed to retrieve users' });
                    }
               })
               res.send(paymentInfo);
          }
     });
}

const paymentFail = async (req, res) => {
     const tran_id = req.params.tran_id;
     const url = `http://localhost:5173/payment/failed`

     res.redirect(url)
}

const getPaymentHistory = async (req, res) => {
     const query = `
          SELECT *
          FROM ((booking_info 
          JOIN booing_payment ON booking_info.booking_id = booing_payment.booking_id)
          JOIN payment_info ON booing_payment.payment_id = payment_info.payment_id)
     `
     connectDB.query(query, (err, result) => {
          if (err) {
               console.log('fetching error: ', err);
               return res.status(500).json({ error: 'Failed to retrieve users' });
          }
          res.send(result);
     })
}

module.exports = { makePayment, paymentSuccess, getPaymentInfo, paymentFail, getPaymentHistory };