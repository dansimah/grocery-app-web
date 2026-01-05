// Environment variable validation
// Run at startup to fail fast if configuration is missing

const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
];

const optionalEnvVars = {
    'PORT': '3001',
    'JWT_EXPIRES_IN': '7d',
    'GOOGLE_API_KEY': null, // Optional - AI features disabled if missing
    'REDIS_URL': null, // Optional - caching disabled if missing
    'FRONTEND_URL': 'http://localhost:5173',
    'NODE_ENV': 'development',
};

function validateEnv() {
    const missing = [];
    const warnings = [];

    // Check required vars
    for (const key of requiredEnvVars) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    // Set defaults for optional vars
    for (const [key, defaultValue] of Object.entries(optionalEnvVars)) {
        if (!process.env[key] && defaultValue !== null) {
            process.env[key] = defaultValue;
        }
    }

    // Warnings for missing optional features
    if (!process.env.GOOGLE_API_KEY) {
        warnings.push('GOOGLE_API_KEY not set - AI parsing will be disabled');
    }

    if (!process.env.REDIS_URL) {
        warnings.push('REDIS_URL not set - using in-memory caching only');
    }

    // Validate JWT_SECRET strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        warnings.push('JWT_SECRET is less than 32 characters - consider using a stronger secret');
    }

    if (process.env.JWT_SECRET === 'change-this-to-a-secure-secret-in-production') {
        if (process.env.NODE_ENV === 'production') {
            missing.push('JWT_SECRET (must be changed from default in production)');
        } else {
            warnings.push('JWT_SECRET is set to default value - change before production');
        }
    }

    // Report
    if (warnings.length > 0) {
        console.warn('⚠️  Environment warnings:');
        warnings.forEach(w => console.warn(`   - ${w}`));
    }

    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(m => console.error(`   - ${m}`));
        process.exit(1);
    }

    console.log('✅ Environment configuration validated');
}

module.exports = { validateEnv };

