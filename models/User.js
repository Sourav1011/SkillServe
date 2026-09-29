const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'professional', 'admin'],
    default: 'customer'
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  profileImage: {
    type: String,
    default: '/images/default-avatar.png'
  },
  // For professionals
  profession: {
    type: String
  },
  serviceCategories: {
    type: [String],
    enum: ['Home Cleaning', 'Salon', 'Appliance Repair', 'Painting', 'Plumbing', 'Electrical', 'Carpentry', 'Pest Control', 'AC Repair', 'Other'],
    default: []
  },
  experience: {
    type: Number
  },
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    workingDays: {
      type: [String],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    timeSlots: [{
      start: {
        type: String,
        default: '9:00 AM'
      },
      end: {
        type: String,
        default: '6:00 PM'
      },
      available: {
        type: Boolean,
        default: true
      }
    }],
    maxBookingsPerDay: {
      type: Number,
      default: 10
    },
    blockedDates: [{
      date: Date,
      reason: String
    }]
  },
  verified: {
    type: Boolean,
    default: false
  },
  // Payment integration
  stripeAccountId: {
    type: String, // Stripe Connect account ID for professionals
    default: null
  },
  stripeOnboardingComplete: {
    type: Boolean,
    default: false
  },
  paymentDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    upiId: String,
    bankName: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
