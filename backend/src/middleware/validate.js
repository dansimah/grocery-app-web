const { validationResult } = require('express-validator');

/**
 * Middleware to handle express-validator errors
 * Use after validation rules in route definitions
 * 
 * Example:
 *   router.post('/example', [
 *     body('email').isEmail(),
 *     body('password').isLength({ min: 6 }),
 *   ], validate, async (req, res) => { ... });
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(e => ({
                field: e.path,
                message: e.msg,
            })),
        });
    }
    next();
};

module.exports = validate;

