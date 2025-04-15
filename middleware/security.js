const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

module.exports = (app) => {
    // ✅ Security Headers (Helmet)
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://trusted.cdn.com"], 
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https://trusted.images.com"],
                connectSrc: ["'self'"]
            }
        },
        referrerPolicy: { policy: "no-referrer" },
        crossOriginResourcePolicy: { policy: "same-origin" }
    }));

    // ✅ CORS Configuration (Restrict Access)
    app.use(cors({
        origin: ['https://yourfrontend.com'], // Replace with allowed origins
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // ✅ Optimized Compression (Skip for Real-time Routes)
    app.use((req, res, next) => {
        if (req.url.includes('/live-location')) {
            next(); // Skip compression for real-time location updates
        } else {
            compression({ level: 2, threshold: 1024 })(req, res, next);
        }
    });

    // ✅ Rate Limiting (Prevent DDoS & Bruteforce)
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit to 100 requests per IP
        message: (req, res) => {
            res.set('Retry-After', Math.ceil(15 * 60)); 
            return 'Too many requests, please try again later.';
        }
    });
    app.use(limiter);

    // ✅ Prevent NoSQL Injection (MongoDB)
    app.use(mongoSanitize());

    // ✅ Prevent XSS Attacks
    app.use(xss());

    console.log('🔒 Advanced Security Middleware Initialized ✅');
};


// Helmet – Protects against common security vulnerabilities.
// CORS – Restricts cross-origin requests.
// Compression – Uses Gzip & Brotli for faster loading.
// Rate Limiting – Prevents DDoS & brute-force attacks.
// MongoSanitize – Blocks NoSQL injection attacks.
// XSS-Clean – Prevents Cross-Site Scripting (XSS) attacks.
// Real-time speed → Skips compression for live location tracking.
// 2️⃣ Enhanced security → Improved CORS, Helmet, and Rate Limiting.
// 3️⃣ Optimized performance → Balanced security without affecting API speed.