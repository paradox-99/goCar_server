const pool = require('../config/db')

const showCarByBrand = async (req, res) => {
     const brand = req.params.brand
     const query = `
          SELECT *
          FROM ((address
          JOIN agencies ON address.address_id = agencies.address_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE $1 = cars.brand
     `
     try {
          const result = await pool.query(query, [brand]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showCarByType = async (req, res) => {
     const car_type = req.params.type

     const query = `
          SELECT *
          FROM ((address
          JOIN agencies ON address.address_id = agencies.address_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE $1 = cars.car_type
     `

     try {
          const result = await pool.query(query, [car_type]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const carsByQuery = async (req, res) => {
     
     const { lat, lon, fromTs, untilTs } = req.query;
     
     const userLat = Number(lat);
     const userLon = Number(lon);

     const query = `
          WITH user_point AS (
            SELECT ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography AS geom
          ),

          nearest_agencies AS (
            SELECT ag.agency_id, ag.address_id, a.geom AS ag_geom,
                   ST_Distance(a.geom, (SELECT geom FROM user_point)) AS distance_m
            FROM agencies ag
            JOIN address a ON a.address_id = ag.address_id
            WHERE ag.verified IS TRUE
              AND ST_DWithin(a.geom, (SELECT geom FROM user_point), 5000)
          ),

          cars_with_booking AS (
            SELECT
              c.car_id              AS vehicle_id,
              'Car'                 AS vehicle_type,
              c.agency_id,
              c.brand,
              c.model,
              c.rental_price,
              c.seats,
              c.images,
              c.fuel,
              c.rating,
              c.status,
              c.verified,
              b.latest_blocking_end,
              na.distance_m
            FROM cars c
            JOIN nearest_agencies na
              ON na.agency_id = c.agency_id
            LEFT JOIN LATERAL (
              SELECT MAX(bi.end_ts) AS latest_blocking_end
              FROM booking_info bi
              WHERE bi.vehicle_type = 'Car'
                AND bi.vehicle_id = c.car_id
                AND bi.status IN ('Confirmed','Running')
            ) b ON true
            WHERE c.verified IS TRUE
          ),
          
          
          bikes_with_booking AS (
            SELECT
              mb.bike_id            AS vehicle_id,
              'Bike'                AS vehicle_type,
              mb.agency_id,
              mb.brand,
              mb.model,
              mb.rental_price,
              mb.mileage,
              mb.images,
              mb.fuel,
              mb.rating,
              mb.status,
              mb.verified,
              b.latest_blocking_end,
              na.distance_m
            FROM bikes mb
            JOIN nearest_agencies na
              ON na.agency_id = mb.agency_id
            LEFT JOIN LATERAL (
              SELECT MAX(bi.end_ts) AS latest_blocking_end
              FROM booking_info bi
              WHERE bi.vehicle_type = 'Bike'
                AND bi.vehicle_id = mb.bike_id
                AND bi.status IN ('Confirmed','Running')
            ) b ON true
            WHERE mb.verified IS TRUE
          ),


          all_vehicles AS (
            SELECT * FROM cars_with_booking
            UNION ALL
            SELECT * FROM bikes_with_booking
          )

          SELECT
            vehicle_type,
            brand,
            model,
            vehicle_id,
            rental_price,
            seats,
            fuel,
            images,
            status,
            rating,
            distance_m
          FROM all_vehicles v
          WHERE
            (
              v.status = 'Available'
              OR (v.latest_blocking_end IS NOT NULL AND v.latest_blocking_end < $3::timestamptz)
            )
          ORDER BY distance_m ASC
          LIMIT 100;
     `
     try {
          const result = await pool.query(query, [userLon, userLat, untilTs]);
          res.json(result.rows);
     } catch (error) {
          console.log(error); 
          
          res.status(500).send(error.message);
     }
}

const carsByFilter = async (req, res) => {
     const params = req.query;
     let query = ''
     if (params.district) {
          query = `
               SELECT cars.*
               FROM ((address
               JOIN agencies ON address.address_id = agencies.address_id)
               JOIN cars ON agencies.agency_id = cars.agency_id)
               WHERE '${params.district}' = address.district
          `
     }
     else if (params.upazilla) {
          query = `
               SELECT *
               FROM ((address
               JOIN agencies ON address.address_id = agencies.address_id)
               JOIN cars ON agencies.agency_id = cars.agency_id)
               WHERE '${params.upazilla}' = address.upazilla
          `
     }

     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const cartCars = async (req, res) => {
     const params = req.query;
     const ids = Object.values(params)

     let query = `
          SELECT *
          FROM cars
          WHERE car_id IN ($1)
     `

     try {
          const result = await pool.query(query, [ids]);
          res.json(result.rows[0]);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showAllCars = async (req, res) => {
     let query = `
     SELECT *
     FROM cars
     JOIN agencies ON cars.agency_id = agencies.agency_id
     `
     try {
          const result = await pool.query(query);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const showAgencyCars = async (req, res) => {
     const id = req.params.id;
     let query = ''

     if (id.includes('AG')) {
          query = `
          SELECT cars.*
          FROM (agencies 
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE agencies.agency_id = $1
     `
     }
     else {
          query = `
          SELECT cars.*
          FROM (( users
          JOIN agencies ON users._id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          WHERE users._id = $1
     `
     }

     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const agencyActiveBookingCars = async (req, res) => {
     const id = req.params.id;
     let query = `
          SELECT cars.brand, cars.model, booking_info.*
          FROM (((users
          JOIN agencies ON users._id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          JOIN booking_info ON cars.car_id = booking_info.vehicle_id)
          WHERE users._id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

module.exports = { showCarByBrand, showCarByType, carsByQuery, carsByFilter, cartCars, showAllCars, showAgencyCars, agencyActiveBookingCars };