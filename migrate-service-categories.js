const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Booking = require('./models/Booking');
const Service = require('./models/Service');

async function updateProfessionalsWithCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Update James Smith (professional123) with Home Cleaning category
    await User.findOneAndUpdate(
      { email: 'professional123@test.com' },
      { 
        $set: {
          serviceCategories: ['Home Cleaning', 'Plumbing', 'Electrical'],
          isOnline: false,
          location: {
            latitude: null,
            longitude: null,
            address: '',
            city: '',
            lastUpdated: new Date()
          }
        }
      }
    );
    
    console.log('✅ Updated James Smith with service categories: Home Cleaning, Plumbing, Electrical');
    
    // Update all bookings to have serviceCategory from their service
    const bookings = await Booking.find().populate('service');
    
    for (const booking of bookings) {
      if (booking.service && !booking.serviceCategory) {
        booking.serviceCategory = booking.service.category;
        await booking.save();
        console.log(`✅ Updated booking ${booking._id} with category: ${booking.service.category}`);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateProfessionalsWithCategories();
