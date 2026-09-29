// Test server endpoints and real-time functionality
const http = require('http');
const https = require('https');

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

function testEndpoint(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testServerEndpoints() {
  log('\n╔══════════════════════════════════════════════════════╗', 'blue');
  log('║      SERVER ENDPOINT & FUNCTIONALITY TESTING         ║', 'blue');
  log('╚══════════════════════════════════════════════════════╝\n', 'blue');

  const endpoints = [
    { path: '/', name: 'Home Page', expectedStatus: 200 },
    { path: '/auth/login', name: 'Login Page', expectedStatus: 200 },
    { path: '/auth/register', name: 'Register Page', expectedStatus: 200 },
    { path: '/services', name: 'Services Page', expectedStatus: 200 },
    { path: '/about', name: 'About Page', expectedStatus: 200 },
    { path: '/contact', name: 'Contact Page', expectedStatus: 200 },
    { path: '/api/services', name: 'Services API', expectedStatus: [200, 302] },
    { path: '/bookings/my-bookings', name: 'My Bookings', expectedStatus: [200, 302] },
    { path: '/wallet', name: 'Wallet', expectedStatus: [200, 302] },
    { path: '/chat', name: 'Chat', expectedStatus: [200, 302] },
    { path: '/notifications', name: 'Notifications', expectedStatus: [200, 302] },
  ];

  let passed = 0;
  let failed = 0;

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('🌐 TESTING SERVER ENDPOINTS', 'yellow');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  for (const endpoint of endpoints) {
    try {
      const response = await testEndpoint(endpoint.path);
      const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
        ? endpoint.expectedStatus 
        : [endpoint.expectedStatus];
      
      if (expectedStatuses.includes(response.status)) {
        log(`✅ ${endpoint.name}`, 'green');
        log(`   Status: ${response.status} ${response.status === 302 ? '(Redirect - requires auth)' : '(OK)'}`, 'cyan');
        passed++;
      } else {
        log(`❌ ${endpoint.name}`, 'red');
        log(`   Expected: ${expectedStatuses.join(' or ')}, Got: ${response.status}`, 'red');
        failed++;
      }
    } catch (error) {
      log(`❌ ${endpoint.name}`, 'red');
      log(`   Error: ${error.message}`, 'red');
      failed++;
    }
  }

  // Test static files
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('📁 TESTING STATIC RESOURCES', 'yellow');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  const staticFiles = [
    '/css/style.css',
    '/js/main.js',
    '/js/socket-client.js',
    '/js/chat.js',
    '/js/notifications.js',
    '/js/booking-wizard.js'
  ];

  for (const file of staticFiles) {
    try {
      const response = await testEndpoint(file);
      if (response.status === 200) {
        log(`✅ ${file}`, 'green');
        passed++;
      } else {
        log(`❌ ${file} - Status: ${response.status}`, 'red');
        failed++;
      }
    } catch (error) {
      log(`❌ ${file} - ${error.message}`, 'red');
      failed++;
    }
  }

  // Summary
  log('\n╔══════════════════════════════════════════════════════╗', 'blue');
  log('║            ENDPOINT TEST SUMMARY                     ║', 'blue');
  log('╚══════════════════════════════════════════════════════╝\n', 'blue');

  const total = passed + failed;
  const successRate = ((passed / total) * 100).toFixed(1);

  log(`Total Endpoints Tested: ${total}`, 'cyan');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${successRate}%\n`, successRate >= 90 ? 'green' : 'yellow');

  if (failed === 0) {
    log('🎉 ALL ENDPOINTS WORKING!', 'green');
  } else {
    log(`⚠️  ${failed} endpoint(s) need attention`, 'yellow');
  }

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
}

// Check if server is running first
log('🔍 Checking if server is running on port 3000...', 'yellow');

testEndpoint('/')
  .then(() => {
    log('✅ Server is running!\n', 'green');
    return testServerEndpoints();
  })
  .catch((error) => {
    log('❌ Server is not running!', 'red');
    log(`   Error: ${error.message}`, 'red');
    log('\n💡 Please start the server with: npm start\n', 'yellow');
    process.exit(1);
  });
