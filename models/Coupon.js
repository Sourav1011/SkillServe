const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  maxDiscount: {
    type: Number // For percentage coupons
  },
  minOrderValue: {
    type: Number,
    default: 0
  },
  categories: [{
    type: String,
    enum: ['Home Cleaning', 'Salon', 'Appliance Repair', 'Painting', 'Plumbing', 'Electrical', 'Carpentry', 'Pest Control', 'AC Repair', 'Other', 'All']
  }],
  validFrom: {
    type: Date,
    required: true
  },
  validUntil: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    default: null // null = unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usersUsed: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  userLimit: {
    type: Number,
    default: 1 // How many times one user can use
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

couponSchema.index({ code: 1 });
couponSchema.index({ validUntil: 1, isActive: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
