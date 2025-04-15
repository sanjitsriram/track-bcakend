const { DataTypes } = require('sequelize');
const sequelize = require('../config/dbconfig');

// ✅ User Model (Driver / Admin)
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  district: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('driver', 'admin'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'blocked'),
    defaultValue: 'active',
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  availability: {
    type: DataTypes.ENUM('available', 'on_trip', 'unavailable'),
    defaultValue: 'available',
  },
  currentOrderId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  totalOrdersCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rating: {
    type: DataTypes.DOUBLE,
    defaultValue: 0.0,
  },
  fcmToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  profileImageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // 🔥 New field: Aadhaar Number
  aadhaarNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      len: [12, 12], // Aadhaar is 12 digits
      isNumeric: true,
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});


// ✅ Location Model
const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id',
    },
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  timestamps: true,
});

// ✅ Order Model
const Order = sequelize.define('Order', {
  orderId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: true, // or false if every order must have a vendor
    references: {
      model: 'Vendor', // this should match the actual table name (case-sensitive)
      key: 'vendorId',
    },
  },
  
  driverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id',
    },
  },
  assignedByAdminId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id',
    },
  },
  driverName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pickupLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deliveryLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'assigned', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },
  pickupTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveryTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  distanceInKm: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0,
  },
  loadWeightInTons: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0,
  },
  goodsType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fare: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// ✅ Vehicle Model
const Vehicle = sequelize.define('Vehicle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4, // Automatically generates a UUID
    primaryKey: true, // Primary key
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'User', // Reference to the 'User' table
      key: 'id',
    },
  },
  vehicleNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ensures vehicle number is unique
  },
  vehicleType: {
    type: DataTypes.ENUM('lorry', 'mini-truck', 'trailer', 'Truck'),
    allowNull: false,
  },
  model: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fuelType: {
    type: DataTypes.STRING,
    allowNull: true, // Optional fuel type
    comment: 'Fuel type of the vehicle (e.g., Petrol, Diesel)',
  },
  rcBookUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  insuranceUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  insuranceExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'in_maintenance'),
    defaultValue: 'active',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

const Vendor = sequelize.define('Vendor', {
  vendorId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pincode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gstNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive', 'Pending', 'Blocked'),
    defaultValue: 'Pending',
  },
  
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  // Additional fields can be added here as needed, for example, the adminId for tracking.
});



const Product = sequelize.define('Product', {
  productId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Vendor',
      key: 'vendorId',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  productType: {
    type: DataTypes.ENUM('grocery', 'restaurant', 'electronics', 'home_goods'),
    allowNull: false,
    defaultValue: 'grocery',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  unitPrice: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  quantityAvailable: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'pcs',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'out-of-stock'),
    defaultValue: 'active',
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});




// ✅ UserLog Model
const UserLog = sequelize.define('UserLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id',
    },
  },
  activity: {
    type: DataTypes.STRING,
    defaultValue: 'registered',
  },
  fcmToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// ✅ Associations
User.hasOne(Location, { foreignKey: 'userId', onDelete: 'CASCADE' });
Location.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

User.hasMany(Order, { foreignKey: 'driverId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

User.hasMany(Order, { foreignKey: 'assignedByAdminId', as: 'assignedOrders' });
Order.belongsTo(User, { foreignKey: 'assignedByAdminId', as: 'admin' });

User.hasOne(Vehicle, { foreignKey: 'userId', as: 'vehicle', onDelete: 'CASCADE' });
Vehicle.belongsTo(User, { foreignKey: 'userId', as: 'driver' });

User.hasMany(UserLog, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserLog.belongsTo(User, { foreignKey: 'user_id' });


Vendor.hasMany(Product, { foreignKey: 'vendorId' });
Product.belongsTo(Vendor, { foreignKey: 'vendorId' });

// ❌ Removed invalid fcmToken foreign key associations

// ✅ Log Success
console.log("🚀 User model synced successfully.");
console.log("🚀 Location model synced successfully.");
console.log("🚀 Order model synced successfully.");
console.log("🚀 Vehicle model synced successfully.");
console.log("🚀 UserLog model synced successfully.");
console.log("🚀 Associations between models created successfully.");

// ✅ Export Models
module.exports = {
  User,
  Location,
  Order,
  Vehicle,
  UserLog,
  Vendor,
  Product
};
