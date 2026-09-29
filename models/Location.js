const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  address: String,
  status: {
    type: String,
    enum: ['on-the-way', 'reached', 'working', 'completed'],
    default: 'on-the-way'
  },
  eta: Date,
  distance: Number, // in kilometers
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

locationSchema.index({ booking: 1 });
locationSchema.index({ professional: 1 });
locationSchema.index({ 'currentLocation': '2dsphere' });

module.exports = mongoose.model('Location', locationSchema);
