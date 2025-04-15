const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const LocalStrategy = require('passport-local').Strategy;
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { User } = require('../models/models');  // Assuming User model is set correctly

const jwtSecret = process.env.JWT_SECRET;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

// ✅ Local Strategy (Email & Password Authentication)
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return done(null, false, { message: 'User not found' });
        }

        const isMatch = await argon2.verify(user.password, password);
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect password' });
        }

        return done(null, user);
    } catch (error) {
        console.error("Error in Local Strategy:", error);
        return done(null, false, { message: 'Internal server error' });
    }
}));

// ✅ JWT Strategy (Token-based Authentication)
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
};

passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    try {
        const user = await User.findByPk(jwtPayload.id); // Use `findByPk` if using Sequelize

        if (!user) {
            return done(null, false, { message: 'Invalid token' });
        }

        return done(null, user);
    } catch (error) {
        console.error("Error in JWT Strategy:", error);
        return done(null, false, { message: 'Internal server error' });
    }
}));

// ✅ Admin Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        if (req.body.email === adminEmail && req.body.password === adminPassword) {
            req.user = { role: 'admin', email: adminEmail }; // Attaching admin data to request
            return next();
        }
        return res.status(403).json({ message: 'Unauthorized admin access' });
    } catch (error) {
        console.error("Admin Authentication Error:", error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// ✅ Generate JWT Token
const generateToken = (user) => {
    try {
        return jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
    } catch (error) {
        console.error("Error generating token:", error);
        throw new Error("Token generation failed");
    }
};

// ✅ Hash Password (for User Registration)
const hashPassword = async (password) => {
    try {
        return await argon2.hash(password, {
            type: argon2.argon2id, // Most secure variant
            memoryCost: 2 ** 16, // More memory for added security
            timeCost: 3, // Computational cost
            parallelism: 1 // Single thread (adjust if needed)
        });
    } catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Password hashing failed");
    }
};

module.exports = { 
    passport, 
    authenticateAdmin, 
    generateToken, 
    hashPassword 
};
