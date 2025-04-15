const winston = require('winston');
require('winston-daily-rotate-file');

// ✅ Daily rotating file transport (logs rotate daily)
const transport = new winston.transports.DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true, // Compress old logs
    maxSize: '10m', // Max log file size
    maxFiles: '14d' // Keep logs for 14 days
});

// ✅ Logger Configuration
const logger = winston.createLogger({
    level: 'info', // Default log level
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({ // Log to console
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        transport, // Log to rotating file
        new winston.transports.File({ filename: 'logs/errors.log', level: 'error' }) // Separate error log file
    ]
});

// ✅ Express Middleware for Logging Requests
const logRequests = (req, res, next) => {
    logger.info(`[${req.method}] ${req.url} - ${req.ip}`);
    next();
};

// ✅ Express Middleware for Error Logging
const logErrors = (err, req, res, next) => {
    logger.error(`Error: ${err.message} | Route: ${req.method} ${req.url}`);
    res.status(500).json({ message: 'Internal Server Error' });
};

module.exports = { logger, logRequests, logErrors };





// A logger is essential in any application for better debugging, monitoring, and security.
// Instead of relying on console.log(),
//  a proper logging system like Winston provides structured and persistent logs.