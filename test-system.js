// Comprehensive System Test for SkillServe Platform
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Wallet = require('./models/Wallet');
const Chat = require('./models/Chat');
const Notification = require('./models/Notification');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testResult(testName, passed, details = '') {
  if (passed) {
    log(`✅ ${testName}`, 'green');
    if (details) log(`   ${details}`, 'cyan');
  } else {
    log(`❌ ${testName}`, 'red');
    if (details) log(`   ${details}`, 'red');
  }
}

async function runTests() {
  try {
    log('\n╔══════════════════════════════════════════════════════╗', 'blue');
    log('║   SKILLSERVE PLATFORM - COMPREHENSIVE TESTING       ║', 'blue');
    log('╚══════════════════════════════════════════════════════╝\n', 'blue');

    // Connect to MongoDB
    log('🔌 Connecting to MongoDB...', 'yellow');
    await mongoose.connect(process.env.MONGODB_URI);
    log('✅ MongoDB connected\n', 'green');

    let passedTests = 0;
    let failedTests = 0;

    // ===== TEST 1: DATABASE MODELS =====
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('📊 TEST 1: DATABASE MODELS & SCHEMAS', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const models = [
      { name: 'User', model: User },
      { name: 'Service', model: Service },
      { name: 'Booking', model: Booking },
      { name: 'Wallet', model: Wallet },
      { name: 'Chat', model: Chat },
      { name: 'Notification', model: Notification }
    ];

    for (const { name, model } of models) {
      try {
        const count = await model.countDocuments();
        testResult(`${name} model`, true, `${count} documents found`);
        passedTests++;
      } catch (error) {
        testResult(`${name} model`, false, error.message);
        failedTests++;
      }
    }

    // ===== TEST 2: USER AUTHENTICATION DATA =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('👥 TEST 2: USER AUTHENTICATION & ROLES', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    testResult('User role distribution', userStats.length > 0, 
      userStats.map(u => `${u._id}: ${u.count}`).join(', '));
    userStats.length > 0 ? passedTests++ : failedTests++;

    const customerCount = await User.countDocuments({ role: 'customer' });
    testResult('Customer accounts', customerCount > 0, `${customerCount} customers`);
    customerCount > 0 ? passedTests++ : failedTests++;

    const professionalCount = await User.countDocuments({ role: 'professional' });
    testResult('Professional accounts', professionalCount > 0, `${professionalCount} professionals`);
    professionalCount > 0 ? passedTests++ : failedTests++;

    const adminCount = await User.countDocuments({ role: 'admin' });
    testResult('Admin accounts', adminCount > 0, `${adminCount} admins`);
    adminCount > 0 ? passedTests++ : failedTests++;

    // ===== TEST 3: SERVICES =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🔧 TEST 3: SERVICE MANAGEMENT', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const totalServices = await Service.countDocuments();
    testResult('Total services', totalServices > 0, `${totalServices} services`);
    totalServices > 0 ? passedTests++ : failedTests++;

    const activeServices = await Service.countDocuments({ active: true });
    testResult('Active services', activeServices > 0, `${activeServices} active`);
    activeServices > 0 ? passedTests++ : failedTests++;

    const categories = await Service.distinct('category');
    testResult('Service categories', categories.length > 0, 
      `${categories.length} categories: ${categories.join(', ')}`);
    categories.length > 0 ? passedTests++ : failedTests++;

    // ===== TEST 4: BOOKINGS =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('📅 TEST 4: BOOKING SYSTEM', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const totalBookings = await Booking.countDocuments();
    testResult('Total bookings', totalBookings >= 0, `${totalBookings} bookings`);
    passedTests++;

    const bookingStatuses = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    testResult('Booking status types', bookingStatuses.length >= 0, 
      bookingStatuses.map(b => `${b._id}: ${b.count}`).join(', ') || 'No bookings yet');
    passedTests++;

    // Check if bookings have required fields
    if (totalBookings > 0) {
      const sampleBooking = await Booking.findOne()
        .populate('customer', 'name')
        .populate('service', 'name')
        .populate('professional', 'name');
      
      testResult('Booking has customer', !!sampleBooking.customer, 
        sampleBooking.customer ? sampleBooking.customer.name : 'Missing');
      sampleBooking.customer ? passedTests++ : failedTests++;

      testResult('Booking has service', !!sampleBooking.service, 
        sampleBooking.service ? sampleBooking.service.name : 'Missing');
      sampleBooking.service ? passedTests++ : failedTests++;

      testResult('Booking has professional', 
        sampleBooking.professional !== undefined, 
        sampleBooking.professional ? sampleBooking.professional.name : 'Not yet assigned');
      passedTests++;
    }

    // ===== TEST 5: WALLET SYSTEM =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('💰 TEST 5: WALLET SYSTEM', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const totalWallets = await Wallet.countDocuments();
    testResult('Wallet records', totalWallets >= 0, `${totalWallets} wallets`);
    passedTests++;

    const walletsWithBalance = await Wallet.countDocuments({ balance: { $gt: 0 } });
    testResult('Wallets with balance', walletsWithBalance >= 0, `${walletsWithBalance} active wallets`);
    passedTests++;

    if (totalWallets > 0) {
      const walletStats = await Wallet.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            totalEarnings: { $sum: '$totalEarnings' },
            totalSpent: { $sum: '$totalSpent' }
          }
        }
      ]);

      if (walletStats.length > 0) {
        const stats = walletStats[0];
        testResult('Wallet statistics', true, 
          `Total balance: ₹${stats.totalBalance.toFixed(2)}, ` +
          `Earnings: ₹${stats.totalEarnings.toFixed(2)}, ` +
          `Spent: ₹${stats.totalSpent.toFixed(2)}`);
        passedTests++;
      }

      // Check wallet transactions
      const walletsWithTransactions = await Wallet.countDocuments({ 
        'transactions.0': { $exists: true } 
      });
      testResult('Wallets with transaction history', walletsWithTransactions >= 0, 
        `${walletsWithTransactions} wallets have transactions`);
      passedTests++;
    }

    // ===== TEST 6: CHAT SYSTEM =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('💬 TEST 6: CHAT SYSTEM', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const totalChats = await Chat.countDocuments();
    testResult('Chat conversations', totalChats >= 0, `${totalChats} conversations`);
    passedTests++;

    if (totalChats > 0) {
      const totalMessages = await Chat.aggregate([
        { $project: { messageCount: { $size: '$messages' } } },
        { $group: { _id: null, total: { $sum: '$messageCount' } } }
      ]);

      testResult('Total messages', totalMessages.length > 0, 
        `${totalMessages[0].total} messages sent`);
      passedTests++;

      const unreadMessages = await Chat.countDocuments({ 
        'messages.read': false 
      });
      testResult('Unread message tracking', unreadMessages >= 0, 
        `${unreadMessages} chats with unread messages`);
      passedTests++;
    }

    // ===== TEST 7: NOTIFICATIONS =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🔔 TEST 7: NOTIFICATION SYSTEM', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const totalNotifications = await Notification.countDocuments();
    testResult('Total notifications', totalNotifications >= 0, `${totalNotifications} notifications`);
    passedTests++;

    if (totalNotifications > 0) {
      const notificationTypes = await Notification.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      testResult('Notification types', notificationTypes.length > 0, 
        notificationTypes.map(n => `${n._id}: ${n.count}`).join(', '));
      passedTests++;

      const unreadNotifications = await Notification.countDocuments({ read: false });
      testResult('Unread notifications', unreadNotifications >= 0, 
        `${unreadNotifications} unread`);
      passedTests++;
    }

    // ===== TEST 8: PROFESSIONAL FEATURES =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('👨‍🔧 TEST 8: PROFESSIONAL FEATURES', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    const onlineProfessionals = await User.countDocuments({ 
      role: 'professional', 
      isOnline: true 
    });
    testResult('Online professionals', onlineProfessionals >= 0, 
      `${onlineProfessionals} online now`);
    passedTests++;

    const availableProfessionals = await User.countDocuments({ 
      role: 'professional', 
      'availability.isAvailable': true 
    });
    testResult('Available professionals', availableProfessionals >= 0, 
      `${availableProfessionals} available`);
    passedTests++;

    const professionalsWithServices = await User.countDocuments({ 
      role: 'professional',
      serviceCategories: { $exists: true, $ne: [] }
    });
    testResult('Professionals with service categories', professionalsWithServices > 0, 
      `${professionalsWithServices} configured`);
    professionalsWithServices > 0 ? passedTests++ : failedTests++;

    // ===== TEST 9: DATA INTEGRITY =====
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('🔍 TEST 9: DATA INTEGRITY', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

    // Check for orphaned bookings
    const orphanedBookings = await Booking.countDocuments({ 
      customer: { $exists: false } 
    });
    testResult('No orphaned bookings', orphanedBookings === 0, 
      orphanedBookings > 0 ? `Found ${orphanedBookings} orphaned bookings` : 'All bookings have customers');
    orphanedBookings === 0 ? passedTests++ : failedTests++;

    // Check for wallets without users
    const allWallets = await Wallet.find().select('user');
    let invalidWallets = 0;
    for (const wallet of allWallets) {
      const userExists = await User.exists({ _id: wallet.user });
      if (!userExists) invalidWallets++;
    }
    testResult('All wallets have valid users', invalidWallets === 0, 
      invalidWallets > 0 ? `Found ${invalidWallets} invalid wallets` : 'All wallets valid');
    invalidWallets === 0 ? passedTests++ : failedTests++;

    // ===== FINAL REPORT =====
    log('\n╔══════════════════════════════════════════════════════╗', 'blue');
    log('║              TEST SUMMARY REPORT                     ║', 'blue');
    log('╚══════════════════════════════════════════════════════╝\n', 'blue');

    const totalTests = passedTests + failedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    log(`Total Tests: ${totalTests}`, 'cyan');
    log(`✅ Passed: ${passedTests}`, 'green');
    log(`❌ Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
    log(`Success Rate: ${successRate}%\n`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');

    if (successRate >= 90) {
      log('🎉 EXCELLENT! System is production-ready!', 'green');
    } else if (successRate >= 70) {
      log('⚠️  GOOD! Minor issues need attention.', 'yellow');
    } else {
      log('❌ CRITICAL! Major issues found. System needs fixes.', 'red');
    }

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  } catch (error) {
    log(`\n❌ FATAL ERROR: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log('🔌 MongoDB connection closed\n', 'yellow');
  }
}

// Run tests
runTests();
