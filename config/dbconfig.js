require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  define: {
    timestamps: false,
    freezeTableName: true,
  },
  dialect: "postgres",
  timezone: "+09:00",
  dialectOptions: {
    useUTC: false,
    keepAlive: true,
  },
  pool: {
    max: 100,
    min: 10,
    acquire: 30000,
    idle: 15000,
  },
  retry: {
    match: [
      /ECONNRESET/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /ConnectionAcquireTimeoutError/,
    ],
    max: 5,
  },
  logging: false,
});

module.exports = sequelize; // ✅ Export directly
