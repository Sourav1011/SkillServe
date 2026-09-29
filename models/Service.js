const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Home Cleaning', 'Salon', 'Appliance Repair', 'Painting', 'Plumbing', 'Electrical', 'Carpentry', 'Pest Control', 'AC Repair', 'Other']
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  image: {
    type: String,
    default: '/images/default-service.jpg'
  },
  features: [{
    type: String
  }],
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Service', serviceSchema);
