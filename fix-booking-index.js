const mongoose = require('mongoose');
require('dotenv').config();

async function fixBookingIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the bookings collection
    const db = mongoose.connection.db;
    const collection = db.collection('bookings');

    // List all indexes
    console.log('\nCurrent indexes:');
    const indexes = await collection.indexes();
    console.log(indexes);

    // Drop the problematic bookingId index
    try {
      await collection.dropIndex('bookingId_1');
      console.log('\n✅ Successfully dropped bookingId_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('\n✅ Index bookingId_1 does not exist (already removed)');
      } else {
        throw error;
      }
    }

    // List indexes again
    console.log('\nIndexes after cleanup:');
    const newIndexes = await collection.indexes();
    console.log(newIndexes);

    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixBookingIndex();
