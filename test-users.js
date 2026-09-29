require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected\n');
    
    const users = await User.find({}, 'name email role');
    
    console.log('📋 Users in database:');
    console.log('━'.repeat(50));
    users.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  ID: ${user._id}`);
      console.log('');
    });
    
    // Test password verification for customer
    const customer = await User.findOne({ email: 'customer@example.com' });
    if (customer) {
      const isValid = await customer.comparePassword('customer123');
      console.log('🔐 Password Test for customer@example.com:');
      console.log(`  Password "customer123" is ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
