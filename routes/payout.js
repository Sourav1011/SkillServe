const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Wallet = require('../models/Wallet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
};

// Check if user is a professional
const isProfessional = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'professional') {
      return res.status(403).json({ error: 'Only professionals can access this' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create Stripe Connect account for professional
router.post('/create-connect-account', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = req.user;

    // Check if user already has a Stripe account
    if (user.stripeAccountId) {
      // Check account status
      const account = await stripe.accounts.retrieve(user.stripeAccountId);
      
      if (account.details_submitted) {
        return res.json({
          success: true,
          accountId: user.stripeAccountId,
          onboardingComplete: true,
          message: 'Your payout account is already set up'
        });
      }

      // If account exists but onboarding not complete, create new onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${req.protocol}://${req.get('host')}/payout/refresh`,
        return_url: `${req.protocol}://${req.get('host')}/payout/return`,
        type: 'account_onboarding',
      });

      return res.json({
        success: true,
        url: accountLink.url,
        accountId: user.stripeAccountId
      });
    }

    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'IN', // India
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        name: user.name,
        product_description: `Professional services - ${user.profession || 'Various services'}`,
        support_email: user.email,
        url: `${req.protocol}://${req.get('host')}/profile/${user._id}`
      },
      metadata: {
        userId: user._id.toString(),
        role: 'professional',
        profession: user.profession || 'service-provider'
      }
    });

    // Save Stripe account ID to user
    user.stripeAccountId = account.id;
    await user.save();

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.protocol}://${req.get('host')}/payout/refresh`,
      return_url: `${req.protocol}://${req.get('host')}/payout/return`,
      type: 'account_onboarding',
    });

    res.json({
      success: true,
      url: accountLink.url,
      accountId: account.id
    });

  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh URL - if onboarding link expires
router.get('/refresh', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeAccountId) {
      return res.redirect('/profile/professional-settings?error=no_account');
    }

    const accountLink = await stripe.accountLinks.create({
      account: user.stripeAccountId,
      refresh_url: `${req.protocol}://${req.get('host')}/payout/refresh`,
      return_url: `${req.protocol}://${req.get('host')}/payout/return`,
      type: 'account_onboarding',
    });

    res.redirect(accountLink.url);

  } catch (error) {
    console.error('Error refreshing account link:', error);
    res.redirect('/profile/professional-settings?error=link_expired');
  }
});

// Return URL - after onboarding complete
router.get('/return', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeAccountId) {
      return res.redirect('/profile/professional-settings?error=no_account');
    }

    // Verify account is fully onboarded
    const account = await stripe.accounts.retrieve(user.stripeAccountId);

    if (account.details_submitted) {
      user.stripeOnboardingComplete = true;
      await user.save();
      return res.redirect('/profile/professional-settings?success=onboarding_complete');
    }

    res.redirect('/profile/professional-settings?error=onboarding_incomplete');

  } catch (error) {
    console.error('Error verifying account:', error);
    res.redirect('/profile/professional-settings?error=verification_failed');
  }
});

// Get payout account status
router.get('/account-status', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeAccountId) {
      return res.json({
        hasAccount: false,
        onboardingComplete: false
      });
    }

    const account = await stripe.accounts.retrieve(user.stripeAccountId);

    res.json({
      hasAccount: true,
      onboardingComplete: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      requirements: account.requirements
    });

  } catch (error) {
    console.error('Error fetching account status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get earnings dashboard data
router.get('/earnings', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = req.user;

    // Get all completed bookings for this professional
    const completedBookings = await Booking.find({
      professionalId: user._id,
      status: 'completed',
      paymentStatus: 'completed'
    }).populate('customerId', 'name email');

    // Calculate earnings
    let totalEarnings = 0;
    let stripeEarnings = 0;
    let walletEarnings = 0;
    let codEarnings = 0;
    let codPending = 0;
    let transferredEarnings = 0;

    completedBookings.forEach(booking => {
      const amount = booking.totalPrice || 0;
      totalEarnings += amount;

      if (booking.paymentMethod === 'online' || booking.paymentMethod === 'card') {
        stripeEarnings += amount;
        if (booking.paymentDetails?.transferredToProfessional) {
          transferredEarnings += booking.paymentDetails.transferAmount || amount;
        }
      } else if (booking.paymentMethod === 'wallet') {
        walletEarnings += amount;
      } else if (booking.paymentMethod === 'cash') {
        codEarnings += amount;
        if (!booking.codDetails?.receivedAt) {
          codPending += amount;
        }
      }
    });

    // Get wallet balance
    let walletBalance = 0;
    const wallet = await Wallet.findOne({ user: user._id });
    if (wallet) {
      walletBalance = wallet.balance || 0;
    }

    res.json({
      totalEarnings,
      stripeEarnings,
      walletEarnings,
      walletBalance,
      codEarnings,
      codPending,
      transferredEarnings,
      pendingTransfer: stripeEarnings - transferredEarnings,
      totalBookings: completedBookings.length,
      recentBookings: completedBookings.slice(-10).reverse()
    });

  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual payout request (for wallet balance)
router.post('/request-payout', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = req.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check wallet balance
    const wallet = await Wallet.findOne({ user: user._id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check if Stripe account is set up
    if (!user.stripeAccountId || !user.stripeOnboardingComplete) {
      return res.status(400).json({ 
        error: 'Please complete your payout account setup first',
        needsOnboarding: true
      });
    }

    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to smallest currency unit
      currency: 'inr',
      destination: user.stripeAccountId,
      description: `Wallet payout for ${user.name}`,
      metadata: {
        userId: user._id.toString(),
        type: 'wallet_payout'
      }
    });

    // Deduct from wallet
    wallet.balance -= amount;
    wallet.transactions.push({
      type: 'debit',
      amount: amount,
      description: 'Payout to bank account',
      status: 'completed',
      metadata: {
        transferId: transfer.id
      }
    });
    await wallet.save();

    res.json({
      success: true,
      transfer: {
        id: transfer.id,
        amount: amount,
        status: transfer.status,
        created: transfer.created
      },
      newBalance: wallet.balance
    });

  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
