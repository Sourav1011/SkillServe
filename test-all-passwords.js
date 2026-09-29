require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected\n');
    
    // Test all three accounts
    const testCredentials = [
      { email: 'customer@example.com', password: 'customer123', role: 'Customer' },
      { email: 'professional@example.com', password: 'professional123', role: 'Professional' },
      { email: 'admin@skillserve.com', password: 'admin123', role: 'Admin' }
    ];
    
    console.log('🔐 Testing All Login Credentials:');
    console.log('━'.repeat(60));
    
    for (const cred of testCredentials) {
      const user = await User.findOne({ email: cred.email });
      
      if (!user) {
        console.log(`\n❌ ${cred.role}: User not found (${cred.email})`);
        continue;
      }
      
      const isValid = await user.comparePassword(cred.password);
      const status = isValid ? '✅ VALID' : '❌ INVALID';
      
      console.log(`\n${status} ${cred.role}:`);
      console.log(`  Email: ${cred.email}`);
      console.log(`  Password: ${cred.password}`);
      console.log(`  Role in DB: ${user.role}`);
      console.log(`  Name: ${user.name}`);
    }
    
    console.log('\n' + '━'.repeat(60));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
