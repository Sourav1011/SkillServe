// Payment Gateway Configuration
// Stripe Integration
// 
// Using Stripe for payment processing
// Test mode credentials configured in .env file

module.exports = {
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    enabled: true
  },
  
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    enabled: false
  },
  
  // Stripe Test Mode (Alternative)
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51234567890',
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_51234567890',
    enabled: false
  },
  
  // Payment settings
  currency: 'INR',
  currencySymbol: '₹',
  
  // For testing, set to true to use test mode
  testMode: true
};
