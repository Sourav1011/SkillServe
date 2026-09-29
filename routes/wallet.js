const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { isAuthenticated } = require('../middleware/auth');

// Initialize Stripe only if valid key is provided
let stripe = null;
try {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && stripeKey.startsWith('sk_')) {
    stripe = require('stripe')(stripeKey);
  }
} catch (error) {
  console.warn('Stripe not initialized. Card payments will not be available.');
}

// Get wallet details
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    
    if (!userId) {
      req.session.error = 'User session invalid';
      return res.redirect('/auth/login');
    }
    
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = new Wallet({ user: userId });
      await wallet.save();
    }

    // Populate booking details for transactions
    const populatedWallet = await Wallet.findById(wallet._id)
      .populate('transactions.booking', 'scheduledDate service status');

    res.render('wallet/index', {
      title: 'My Wallet',
      wallet: populatedWallet
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    req.session.error = 'Error loading wallet';
    res.redirect('/');
  }
});

// Create Stripe Checkout Session for adding money
router.post('/create-checkout-session', isAuthenticated, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.user.id || req.session.user._id;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check if Stripe is configured
    if (!stripe) {
      return res.status(503).json({ 
        error: 'Card payments are not configured. Please use Test Mode or contact administrator to set up Stripe.' 
      });
    }

    // Stripe requires minimum 50 cents (approximately ₹42)
    if (amount < 42) {
      return res.status(400).json({ 
        error: 'Minimum amount for card payment is ₹42 (Stripe requirement). Please use Test Mode for smaller amounts.' 
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: 'Add Money to Wallet',
              description: `Add ₹${amount} to your SkillServe wallet`,
            },
            unit_amount: Math.round(parseFloat(amount) * 100), // Amount in paise
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/wallet?cancelled=true`,
      client_reference_id: userId.toString(),
      metadata: {
        userId: userId.toString(),
        amount: amount.toString()
      }
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Error processing payment' });
  }
});

// Handle successful payment
router.get('/success', isAuthenticated, async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    
    if (!sessionId) {
      req.session.error = 'Invalid payment session';
      return res.redirect('/wallet');
    }

    if (!stripe) {
      req.session.error = 'Payment processing is not available';
      return res.redirect('/wallet');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      const userId = session.metadata.userId;
      const amount = parseFloat(session.metadata.amount);

      let wallet = await Wallet.findOne({ user: userId });
      
      if (!wallet) {
        wallet = new Wallet({ user: userId });
      }

      wallet.balance += amount;
      wallet.totalEarnings += amount;
      wallet.transactions.push({
        type: 'credit',
        amount: amount,
        description: 'Money added via Stripe',
        paymentMethod: 'card',
        transactionId: session.payment_intent,
        status: 'completed',
        timestamp: new Date()
      });

      await wallet.save();

      // Send real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${userId}`).emit('wallet-updated', {
          balance: wallet.balance,
          amount: amount,
          type: 'credit'
        });
      }

      // Create notification
      await Notification.create({
        user: userId,
        type: 'payment',
        title: '💰 Money Added Successfully',
        message: `₹${amount} has been added to your wallet`,
        priority: 'medium'
      });

      req.session.success = `₹${amount} added successfully to your wallet!`;
    }

    res.redirect('/wallet');
  } catch (error) {
    console.error('Error processing payment success:', error);
    req.session.error = 'Error processing payment';
    res.redirect('/wallet');
  }
});

// Add money to wallet (fallback for testing without payment gateway)
router.post('/add', isAuthenticated, async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId } = req.body;
    const userId = req.session.user.id || req.session.user._id;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = new Wallet({ user: userId });
    }

    // Normalize payment method to match schema enum
    const normalizedPaymentMethod = (paymentMethod || 'test').toLowerCase()
      .replace(/\s+/g, '-')  // Replace spaces with hyphens
      .replace('credit-card', 'card')
      .replace('debit-card', 'card')
      .replace('net-banking', 'netbanking');

    wallet.balance += parseFloat(amount);
    wallet.totalEarnings += parseFloat(amount);
    wallet.transactions.push({
      type: 'credit',
      amount: parseFloat(amount),
      description: 'Money added to wallet',
      paymentMethod: normalizedPaymentMethod,
      transactionId: transactionId || 'TEST-' + Date.now(),
      status: 'completed',
      timestamp: new Date()
    });

    await wallet.save();

    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${userId}`).emit('wallet-updated', {
        balance: wallet.balance,
        amount: parseFloat(amount),
        type: 'credit'
      });
    }

    res.json({ success: true, balance: wallet.balance });
  } catch (error) {
    console.error('Error adding money:', error);
    res.status(500).json({ error: 'Error adding money to wallet' });
  }
});

// Deduct from wallet (for bookings)
router.post('/deduct', isAuthenticated, async (req, res) => {
  try {
    const { amount, bookingId, description } = req.body;
    const userId = req.session.user.id || req.session.user._id;
    
    const wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    wallet.balance -= parseFloat(amount);
    wallet.totalSpent += parseFloat(amount);
    wallet.transactions.push({
      type: 'debit',
      amount: parseFloat(amount),
      description: description || 'Payment for booking',
      booking: bookingId,
      paymentMethod: 'wallet',
      status: 'completed',
      timestamp: new Date()
    });

    await wallet.save();

    res.json({ success: true, balance: wallet.balance });
  } catch (error) {
    console.error('Error deducting from wallet:', error);
    res.status(500).json({ error: 'Error processing payment' });
  }
});

// Get wallet balance
router.get('/balance', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    const wallet = await Wallet.findOne({ user: userId });
    res.json({ balance: wallet ? wallet.balance : 0 });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Error fetching balance' });
  }
});

// Wallet-to-wallet transfer
router.post('/transfer', isAuthenticated, async (req, res) => {
  try {
    const { recipientEmail, amount, description } = req.body;
    const senderId = req.session.user.id || req.session.user._id;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    // Find recipient
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    if (recipient._id.toString() === senderId.toString()) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    // Get sender's wallet
    let senderWallet = await Wallet.findOne({ user: senderId });
    if (!senderWallet || senderWallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Get or create recipient's wallet
    let recipientWallet = await Wallet.findOne({ user: recipient._id });
    if (!recipientWallet) {
      recipientWallet = new Wallet({ user: recipient._id });
    }

    // Perform transfer
    const transferAmount = parseFloat(amount);
    senderWallet.balance -= transferAmount;
    senderWallet.totalSpent += transferAmount;
    senderWallet.transactions.push({
      type: 'debit',
      amount: transferAmount,
      description: description || `Transfer to ${recipient.name}`,
      paymentMethod: 'wallet-transfer',
      status: 'completed',
      timestamp: new Date(),
      recipientId: recipient._id
    });

    recipientWallet.balance += transferAmount;
    recipientWallet.totalEarnings += transferAmount;
    recipientWallet.transactions.push({
      type: 'credit',
      amount: transferAmount,
      description: description || `Received from ${req.session.user.name || 'User'}`,
      paymentMethod: 'wallet-transfer',
      status: 'completed',
      timestamp: new Date(),
      senderId: senderId
    });

    await senderWallet.save();
    await recipientWallet.save();

    // Send real-time notifications
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${senderId}`).emit('wallet-updated', {
        balance: senderWallet.balance,
        amount: transferAmount,
        type: 'debit',
        message: `₹${transferAmount} sent to ${recipient.name}`
      });

      io.to(`user-${recipient._id}`).emit('wallet-updated', {
        balance: recipientWallet.balance,
        amount: transferAmount,
        type: 'credit',
        message: `₹${transferAmount} received from ${req.session.user.name || 'User'}`
      });
    }

    // Create notifications
    await Notification.create([
      {
        user: senderId,
        type: 'payment',
        title: '💸 Money Sent',
        message: `₹${transferAmount} sent to ${recipient.name}`,
        priority: 'medium'
      },
      {
        user: recipient._id,
        type: 'payment',
        title: '💰 Money Received',
        message: `₹${transferAmount} received from ${req.session.user.name || 'User'}`,
        priority: 'high'
      }
    ]);

    res.json({ 
      success: true, 
      balance: senderWallet.balance,
      message: `₹${transferAmount} transferred successfully to ${recipient.name}`
    });
  } catch (error) {
    console.error('Error transferring money:', error);
    res.status(500).json({ error: 'Error transferring money' });
  }
});

// Get transaction history
router.get('/transactions', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    const wallet = await Wallet.findOne({ user: userId })
      .populate('transactions.booking', 'scheduledDate service status');

    const transactions = wallet ? wallet.transactions.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    ) : [];

    res.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Error fetching transactions' });
  }
});

// Add refund to wallet
async function addRefund(userId, amount, bookingId) {
  try {
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = new Wallet({ user: userId });
    }

    wallet.balance += parseFloat(amount);
    wallet.totalEarnings += parseFloat(amount);
    wallet.transactions.push({
      type: 'credit',
      amount: parseFloat(amount),
      description: 'Refund for cancelled booking',
      booking: bookingId,
      paymentMethod: 'refund',
      status: 'completed',
      timestamp: new Date()
    });

    await wallet.save();
    return wallet;
  } catch (error) {
    console.error('Error adding refund:', error);
    throw error;
  }
}

// Add cashback to wallet
async function addCashback(userId, amount, bookingId) {
  try {
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = new Wallet({ user: userId });
    }

    wallet.balance += parseFloat(amount);
    wallet.totalEarnings += parseFloat(amount);
    wallet.transactions.push({
      type: 'credit',
      amount: parseFloat(amount),
      description: 'Cashback earned',
      booking: bookingId,
      paymentMethod: 'cashback',
      status: 'completed',
      timestamp: new Date()
    });

    await wallet.save();
    return wallet;
  } catch (error) {
    console.error('Error adding cashback:', error);
    throw error;
  }
}

module.exports = router;
module.exports.addRefund = addRefund;
module.exports.addCashback = addCashback;
