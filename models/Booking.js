const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  serviceCategory: {
    type: String,
    enum: ['Home Cleaning', 'Salon', 'Appliance Repair', 'Painting', 'Plumbing', 'Electrical', 'Carpentry', 'Pest Control', 'AC Repair', 'Other']
  },
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'assigned', 'in-progress', 'completed', 'cancelled', 'awaiting-payment'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'wallet', 'online', 'card', 'upi'],
    default: 'cash'
  },
  notes: {
    type: String
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String
  },
  paymentDetails: {
    orderId: String,
    paymentId: String,
    signature: String,
    paidAt: Date,
    error: String,
    failedAt: Date,
    stripeSessionId: String,
    stripePaymentIntentId: String,
    stripeTransferId: String, // For Stripe Connect transfers
    transferredToProfessional: Boolean,
    transferAmount: Number,
    platformFee: Number,
    transferredAt: Date
  },
  codDetails: {
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receivedAt: Date,
    verifiedByAdmin: Boolean,
    notes: String
  },
  completedAt: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['customer', 'professional', 'admin']
  },
  cancelledAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
