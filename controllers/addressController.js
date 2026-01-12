const addressService = require('../services/addressService');
const addressValidator = require('../validators/addressValidator');
const asyncHandler = require('../utils/asyncHandler');
const HTTP_STATUS = require('../constants/httpStatus');


const updateAddressById = asyncHandler(async (req, res) => {

     
     console.log(req.body);
     // Validate address ID
     const addressId = addressValidator.validateAddressId(req.params.addressId);
     
     // Validate and sanitize only provided fields in the request body
     const validatedData = addressValidator.validateUpdateAddress(req.body);

     // Call the service to update address
     const updatedAddress = await addressService.updateAddress(addressId, validatedData);

     // Send success response
     res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'Address updated successfully',
          data: updatedAddress
     });
});


const getAddressById = asyncHandler(async (req, res) => {
     // Validate address ID
     const addressId = addressValidator.validateAddressId(req.params.addressId);

     // Get address
     const address = await addressService.getAddressById(addressId);

     // Send success response
     res.status(HTTP_STATUS.OK).json({
          success: true,
          data: address
     });
});

const createAddress = asyncHandler(async (req, res) => {
     // Validate and sanitize the request body
     const validatedData = addressValidator.validateCreateAddress(req.body);

     // Call the service to create address
     const newAddress = await addressService.createAddress(validatedData);

     // Send success response
     res.status(HTTP_STATUS.CREATED).json({
          success: true,
          message: 'Address created successfully',
          data: newAddress
     });
});

module.exports = {
     updateAddressById,
     getAddressById
};
