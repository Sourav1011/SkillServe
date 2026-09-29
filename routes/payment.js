const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const paymentConfig = require('../config/payment');

// Create Stripe Checkout Session
router.post('/create-order', isAuthenticated, async (req, res) => {
  try {
    const { amount, bookingId, currency = 'INR' } = req.body;
    
    console.log('Creating Stripe checkout session:', { amount, bookingId, currency });
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Create Stripe Checkout Session with card payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Universal card payment support
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Skill Serve - Service Booking',
              description: `Payment for booking service`,
              images: ['https://i.imgur.com/EHyR2nP.png'],
            },
            unit_amount: Math.round(amount * 100), // Amount in smallest currency unit
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/payment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingId}`,
      cancel_url: `${req.protocol}://${req.get('host')}/payment/cancel?bookingId=${bookingId}`,
      customer_email: req.session.user.email || undefined,
      billing_address_collection: 'auto',
      metadata: {
        bookingId: bookingId,
        userId: req.session.user.id,
        userName: req.session.user.name || 'Customer'
      },
      payment_intent_data: {
        metadata: {
          bookingId: bookingId,
          integration: 'skill_serve'
        }
      }
    });
    
    console.log('Stripe checkout session created:', session.id);
    console.log('Redirect URL:', session.url);
    
    // Store session in server session
    req.session.pendingPayment = {
      sessionId: session.id,
      amount: amount,
      bookingId: bookingId,
      userId: req.session.user.id
    };
    
    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create payment session', 
      details: error.message 
    });
  }
});

// Verify payment
router.post('/verify', isAuthenticated, async (req, res) => {
  try {
    const { paymentIntentId, bookingId } = req.body;
    
    console.log('Verifying Stripe payment:', { paymentIntentId, bookingId });
    
    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      console.error('Payment not succeeded:', paymentIntent.status);
      return res.status(400).json({ 
        success: false, 
        error: 'Payment not completed',
        status: paymentIntent.status
      });
    }
    
    console.log('Payment verified successfully');
    
    // Update booking payment status
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = 'completed';
        booking.paymentDetails = {
          paymentIntentId: paymentIntent.id,
          paymentMethod: paymentIntent.payment_method,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          paidAt: new Date()
        };
        await booking.save();
        console.log('Booking payment status updated:', bookingId);
      } else {
        console.error('Booking not found:', bookingId);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Payment verified successfully',
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Payment verification failed',
      details: error.message
    });
  }
});

// Handle payment failure
router.post('/failed', isAuthenticated, async (req, res) => {
  try {
    const { bookingId, error } = req.body;
    
    console.log('Payment failed:', { bookingId, error });
    
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = 'failed';
        booking.paymentDetails = {
          error: error,
          failedAt: new Date()
        };
        await booking.save();
        console.log('Booking payment failure recorded:', bookingId);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Payment failure recorded' 
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record payment failure' 
    });
  }
});

// Payment success callback
router.get('/success', isAuthenticated, async (req, res) => {
  try {
    const { session_id, bookingId } = req.query;
    
    console.log('Payment success callback:', { session_id, bookingId });
    
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      // Update booking
      const booking = await Booking.findById(bookingId).populate('professionalId');
      if (booking) {
        const amountPaid = session.amount_total / 100; // Convert from cents
        const platformFeePercent = 10; // 10% platform fee
        const platformFee = (amountPaid * platformFeePercent) / 100;
        const professionalAmount = amountPaid - platformFee;

        booking.paymentStatus = 'completed';
        booking.paymentDetails = {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
          paidAt: new Date()
        };

        // If professional has Stripe Connect account, transfer money automatically
        if (booking.professionalId && booking.professionalId.stripeAccountId && booking.professionalId.stripeOnboardingComplete) {
          try {
            // Create transfer to professional's connected account
            const transfer = await stripe.transfers.create({
              amount: Math.round(professionalAmount * 100), // Amount in cents
              currency: session.currency,
              destination: booking.professionalId.stripeAccountId,
              description: `Payment for booking #${booking._id}`,
              metadata: {
                bookingId: booking._id.toString(),
                professionalId: booking.professionalId._id.toString(),
                customerId: booking.customerId.toString()
              },
              source_transaction: session.payment_intent
            });

            // Update booking with transfer details
            booking.paymentDetails.stripeTransferId = transfer.id;
            booking.paymentDetails.transferredToProfessional = true;
            booking.paymentDetails.transferAmount = professionalAmount;
            booking.paymentDetails.platformFee = platformFee;
            booking.paymentDetails.transferredAt = new Date();

            console.log('Transfer created to professional:', transfer.id);
          } catch (transferError) {
            console.error('Error creating transfer:', transferError);
            // Payment succeeded but transfer failed - needs manual resolution
            booking.paymentDetails.transferredToProfessional = false;
            booking.paymentDetails.platformFee = platformFee;
            booking.paymentDetails.transferAmount = professionalAmount;
          }
        } else {
          // Professional doesn't have payout account set up
          booking.paymentDetails.transferredToProfessional = false;
          booking.paymentDetails.platformFee = platformFee;
          booking.paymentDetails.transferAmount = professionalAmount;
          console.log('Professional payout account not set up - transfer pending');
        }

        await booking.save();
        console.log('Booking payment completed:', bookingId);
      }
      
      // Redirect to booking details with success message
      res.redirect(`/bookings/${bookingId}?payment=success`);
    } else {
      res.redirect(`/bookings/${bookingId}?payment=pending`);
    }
  } catch (error) {
    console.error('Error in payment success:', error);
    res.redirect('/bookings/my-bookings?error=payment_verification_failed');
  }
});

// Payment cancel callback
router.get('/cancel', isAuthenticated, async (req, res) => {
  try {
    const { bookingId } = req.query;
    
    console.log('Payment cancelled:', { bookingId });
    
    // Update booking
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = 'failed';
        booking.paymentDetails = {
          error: 'Payment cancelled by user',
          failedAt: new Date()
        };
        await booking.save();
      }
    }
    
    res.redirect(`/bookings/${bookingId}?payment=cancelled`);
  } catch (error) {
    console.error('Error in payment cancel:', error);
    res.redirect('/bookings/my-bookings?error=payment_cancelled');
  }
});

// Get payment status
router.get('/status/:bookingId', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      amount: booking.totalAmount,
      paymentDetails: booking.paymentDetails
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

module.exports = router;
