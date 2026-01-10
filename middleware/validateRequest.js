/**
 * Request Validation Middleware Factory
 * Creates middleware that validates request data using provided validator function
 * 
 * @param {Function} validatorFn - Validation function to execute
 * @param {string} source - Source of data to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
const validateRequest = (validatorFn, source = 'body') => {
     return (req, res, next) => {
          try {
               const dataToValidate = req[source];
               const validatedData = validatorFn(dataToValidate);
               
               // Replace original data with sanitized data
               req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = validatedData;
               
               next();
          } catch (error) {
               next(error);
          }
     };
};

module.exports = validateRequest;
