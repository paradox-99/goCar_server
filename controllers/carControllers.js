const pool = require('../config/db')
const HTTP_STATUS = require('../constants/httpStatus');
const MESSAGES = require('../constants/messages');
const carService = require('../services/carService');
const carValidator = require('../validators/carValidator');
const asyncHandler = require('../utils/asyncHandler');

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
              AND ST_DWithin(a.geom, (SELECT geom FROM user_point), 3000)
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
            verified,
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
          res.status(500).send(error.message);
     }
}

const carsByFilter = async (req, res) => {
     const params = req.query;
     let query = ''
     let values = [];
     if (params.district) {
          query = `
               SELECT cars.*
               FROM ((address
               JOIN agencies ON address.address_id = agencies.address_id)
               JOIN cars ON agencies.agency_id = cars.agency_id)
               WHERE address.city = $1
          `
          values = [params.district];
     }
     else if (params.upazilla) {
          query = `
               SELECT *
               FROM ((address
               JOIN agencies ON address.address_id = agencies.address_id)
               JOIN cars ON agencies.agency_id = cars.agency_id)
               WHERE address.area = $1
          `
          values = [params.upazilla];
     }
     else {
          return res.status(400).json({ message: 'Missing filter parameter' });
     }

     try {
          const result = await pool.query(query, values);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const carDetails = async (req, res) => {
     const id = req.params.id;

     let query = `
          SELECT cars.*, agencies.agency_id, agencies.agency_name, agencies.owner_id, agencies.email
          FROM cars
          JOIN agencies ON cars.agency_id = agencies.agency_id
          WHERE cars.car_id = $1
     `

     try {
          const result = await pool.query(query, [id]);
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

const getCarReviews = async (req, res) => {
     const id = req.params.id;
     
     let query = `
          SELECT cr.*, u.name, u.photo
          FROM cars_reviews as cr
          JOIN users as u ON cr.user_id = u.user_id
          WHERE cr.car_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
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
          SELECT car_id as vehicle_id, brand, model, car_type, build_year, images, rental_price, status, rating, rating_count, review_count, verified, fuel, mileage, gear, seats, NULL as engine_capacity, transmission_type, 'car' as vehicle_type
          FROM cars
          WHERE agency_id = $1
          UNION ALL
          SELECT bike_id as vehicle_id, brand, model, car_type, build_year, images, rental_price, status, rating, rating_count, review_count, verified, fuel, mileage, gear, 0 as seats, engine_capacity, NULL as transmission_type, 'bike' as vehicle_type
          FROM bikes
          WHERE agency_id = $1
     `
     }
     else {
          query = `
          SELECT c.car_id as vehicle_id, c.brand, c.model, c.car_type, c.build_year, c.images, c.rental_price, c.status, c.rating, c.rating_count, c.review_count, c.verified, c.fuel, c.mileage, c.gear, c.seats, NULL as engine_capacity, c.transmission_type, 'car' as vehicle_type
          FROM users u
          JOIN agencies a ON u.user_id = a.owner_id
          JOIN cars c ON a.agency_id = c.agency_id
          WHERE u.user_id = $1
          UNION ALL
          SELECT b.bike_id as vehicle_id, b.brand, b.model, b.car_type, b.build_year, b.images, b.rental_price, b.status, b.rating, b.rating_count, b.review_count, b.verified, b.fuel, b.mileage, b.gear, 0 as seats, b.engine_capacity, NULL as transmission_type, 'bike' as vehicle_type
          FROM users u
          JOIN agencies a ON u.user_id = a.owner_id
          JOIN bikes b ON a.agency_id = b.agency_id
          WHERE u.user_id = $1
     `
     }

     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          console.error("Error in showAgencyCars:", error);
          res.status(500).send(error.message);
     }
}

const agencyActiveBookingCars = async (req, res) => {
     const id = req.params.id;
     let query = `
          SELECT cars.brand, cars.model, booking_info.*
          FROM (((users
          JOIN agencies ON users.user_id = agencies.owner_id)
          JOIN cars ON agencies.agency_id = cars.agency_id)
          JOIN booking_info ON cars.car_id = booking_info.vehicle_id)
          WHERE users.user_id = $1
     `
     try {
          const result = await pool.query(query, [id]);
          res.json(result.rows);
     } catch (error) {
          res.status(500).send(error.message);
     }
}

const createCar = asyncHandler(async (req, res) => {
     const validatedData = carValidator.validateCreateCar(req.body);

     const createdCar = await carService.createCar(validatedData);

     res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: MESSAGES.CAR_CREATED,
          data: createdCar
     });
});

const updateCarInfo = asyncHandler(async (req, res) => {
     const carId = carValidator.validateCarId(req.params.id);
     const validatedData = carValidator.validateUpdateCarInfo(req.body);

     const updatedCar = await carService.updateCarInfo(carId, validatedData);

     res.status(HTTP_STATUS.OK).json({
          success: true,
          message: MESSAGES.CAR_UPDATED,
          data: updatedCar
     });
});

// ── Favourites ──────────────────────────────────────────────────────────────

const addFavourite = asyncHandler(async (req, res) => {
     const { userId, carId } = req.body;
     await pool.query(
          `INSERT INTO favourite_cars (user_id, car_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, carId]
     );
     res.status(HTTP_STATUS.OK).json({ success: true, message: 'Added to favourites' });
});

const removeFavourite = asyncHandler(async (req, res) => {
     const { userId, carId } = req.body;
     await pool.query(
          `DELETE FROM favourite_cars WHERE user_id = $1 AND car_id = $2`,
          [userId, carId]
     );
     res.status(HTTP_STATUS.OK).json({ success: true, message: 'Removed from favourites' });
});

const clearAllFavourites = asyncHandler(async (req, res) => {
     const { userId } = req.params;
     await pool.query(`DELETE FROM favourite_cars WHERE user_id = $1`, [userId]);
     res.status(HTTP_STATUS.OK).json({ success: true, message: 'All favourites cleared' });
});

const getUserFavourites = asyncHandler(async (req, res) => {
     const { userId } = req.params;
     const result = await pool.query(
          `SELECT c.car_id, c.brand, c.model, c.images, c.rental_price,
                  c.seats, c.fuel, c.transmission_type, c.mileage, c.gear,
                  c.air_conditioning, c.gps, c.bluetooth, c.rating, c.build_year,
                  fc.added_at
           FROM favourite_cars fc
           JOIN cars c ON fc.car_id = c.car_id
           WHERE fc.user_id = $1
           ORDER BY fc.added_at DESC`,
          [userId]
     );
     res.json(result.rows);
});

const checkFavourite = asyncHandler(async (req, res) => {
     const { userId, carId } = req.params;
     const result = await pool.query(
          `SELECT 1 FROM favourite_cars WHERE user_id = $1 AND car_id = $2`,
          [userId, carId]
     );
     res.json({ isFavourite: result.rowCount > 0 });
});

module.exports = { showCarByBrand, showCarByType, carsByQuery, carsByFilter, carDetails, showAllCars, showAgencyCars, agencyActiveBookingCars, getCarReviews, createCar, updateCarInfo, addFavourite, removeFavourite, clearAllFavourites, getUserFavourites, checkFavourite };