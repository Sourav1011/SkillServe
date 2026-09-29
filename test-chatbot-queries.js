// Test script to demonstrate enhanced chatbot queries
const mongoose = require('mongoose');
const chatbot = require('./utils/chatbot');
require('dotenv').config();

// Sample test queries
const testQueries = [
  {
    message: "Which professionals are available for home cleaning?",
    context: { userId: "test123", userName: "John", userRole: "customer" }
  },
  {
    message: "show me electricians available",
    context: { userId: "test123", userName: "John", userRole: "customer" }
  },
  {
    message: "professionals for salon services",
    context: { userId: "test123", userName: "John", userRole: "customer" }
  },
  {
    message: "what are the available slots for plumbing?",
    context: { userId: "test123", userName: "John", userRole: "customer" }
  },
  {
    message: "show me available time slots for home cleaning",
    context: { userId: "test123", userName: "John", userRole: "customer" }
  },
  {
    message: "when are professionals available?",
    context: { userId: "test123", userName: "John", userRole: "customer" }
  }
];

async function testChatbot() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillserve');
    console.log('✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('TESTING ENHANCED CHATBOT QUERIES');
    console.log('='.repeat(80));
    console.log('\n');

    for (const query of testQueries) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`\n👤 USER: "${query.message}"`);
      console.log(`\n🤖 CHATBOT RESPONSE:\n`);
      
      const response = await chatbot.getResponse(query.message, query.context);
      console.log(response);
      
      console.log(`\n${'─'.repeat(80)}\n`);
    }

    console.log('\n✅ All test queries completed!\n');
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testChatbot();
