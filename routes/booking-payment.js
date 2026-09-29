const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { isAuthenticated } = require('../middleware/auth');

// Get payment page for accepted booking
router.get('/:bookingId/payment', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('customerId')
      .populate('professionalId')
      .populate('serviceId');

    if (!booking) {
      return res.status(404).render('error', { 
        title: 'Booking Not Found',
        message: 'This booking does not exist.',
        user: req.session?.user || null
      });
    }

    // Verify user is the customer
    if (booking.customerId._id.toString() !== req.session.user.id) {
      return res.status(403).render('error', { 
        title: 'Unauthorized',
        message: 'You are not authorized to pay for this booking.',
        user: req.session?.user || null
      });
    }

    // Check if booking is awaiting payment
    if (booking.status !== 'awaiting-payment') {
      return res.redirect(`/bookings/${booking._id}?error=invalid-status`);
    }

    // Get customer wallet balance
    const wallet = await Wallet.findOne({ user: booking.customerId._id });

    res.render('bookings/payment', { 
      title: 'Complete Payment',
      booking,
      wallet: wallet || { balance: 0 },
      user: req.session.user
    });

  } catch (error) {
    console.error('Error loading payment page:', error);
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Failed to load payment page',
      user: req.session?.user || null
    });
  }
});

// Process payment (wallet, online, COD)
router.post('/:bookingId/process-payment', isAuthenticated, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const booking = await Booking.findById(req.params.bookingId)
      .populate('customerId')
      .populate('professionalId')
      .populate('serviceId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify user is the customer
    if (booking.customerId._id.toString() !== req.session.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if booking is awaiting payment
    if (booking.status !== 'awaiting-payment') {
      return res.status(400).json({ error: 'Booking is not awaiting payment' });
    }

    const amount = booking.totalPrice;
    const platformFeePercent = 10;
    const platformFee = (amount * platformFeePercent) / 100;
    const professionalAmount = amount - platformFee;

    // Handle WALLET PAYMENT
    if (paymentMethod === 'wallet') {
      const customerWallet = await Wallet.findOne({ user: booking.customerId._id });
      
      if (!customerWallet || customerWallet.balance < amount) {
        return res.status(400).json({ error: 'Insufficient wallet balance' });
      }

      // Deduct from customer wallet
      customerWallet.balance -= amount;
      customerWallet.transactions.push({
        type: 'debit',
        amount: amount,
        description: `Payment for ${booking.serviceId.name}`,
        status: 'completed',
        metadata: {
          bookingId: booking._id,
          professionalId: booking.professionalId._id
        }
      });
      await customerWallet.save();

      // Credit to professional wallet
      let professionalWallet = await Wallet.findOne({ user: booking.professionalId._id });
      if (!professionalWallet) {
        professionalWallet = new Wallet({
          user: booking.professionalId._id,
          balance: 0,
          transactions: []
        });
      }

      professionalWallet.balance += professionalAmount;
      professionalWallet.transactions.push({
        type: 'credit',
        amount: professionalAmount,
        description: `Payment received for ${booking.serviceId.name}`,
        status: 'completed',
        metadata: {
          bookingId: booking._id,
          customerId: booking.customerId._id,
          platformFee: platformFee
        }
      });
      await professionalWallet.save();

      // Update booking
      booking.paymentStatus = 'completed';
      booking.paymentMethod = 'wallet';
      booking.status = 'confirmed';
      booking.paymentDetails = {
        transferredToProfessional: true,
        transferAmount: professionalAmount,
        platformFee: platformFee,
        transferredAt: new Date(),
        paidAt: new Date()
      };
      await booking.save();

      // Notify professional
      await Notification.create({
        user: booking.professionalId._id,
        type: 'payment-received',
        title: '💰 Payment Received!',
        message: `${booking.customerId.name} paid ₹${professionalAmount} for ${booking.serviceId.name}. Booking confirmed!`,
        priority: 'high',
        data: { bookingId: booking._id }
      });

      // Notify customer
      await Notification.create({
        user: booking.customerId._id,
        type: 'payment-success',
        title: '✅ Payment Successful!',
        message: `Your payment of ₹${amount} for ${booking.serviceId.name} is confirmed. Booking confirmed!`,
        priority: 'high',
        data: { bookingId: booking._id }
      });

      const io = req.app.get('io');
      if (io) {
        // Notify professional
        io.to(`user-${booking.professionalId._id}`).emit('payment-received', {
          bookingId: booking._id,
          amount: professionalAmount,
          customerName: booking.customerId.name,
          timestamp: new Date()
        });
        
        // Notify customer
        io.to(`user-${booking.customerId._id}`).emit('payment-confirmed', {
          bookingId: booking._id,
          amount: amount,
          professionalName: booking.professionalId.name,
          timestamp: new Date()
        });
        
        // Broadcast booking update
        io.to(`booking-${booking._id}`).emit('booking-status-update', {
          bookingId: booking._id,
          status: 'confirmed',
          paymentStatus: 'completed',
          timestamp: new Date()
        });
      }

      return res.json({
        success: true,
        message: 'Payment successful! Booking confirmed.',
        bookingId: booking._id
      });
    }

    // Handle CASH ON DELIVERY
    if (paymentMethod === 'cash') {
      booking.paymentMethod = 'cash';
      booking.paymentStatus = 'pending';
      booking.status = 'confirmed';
      booking.paymentDetails = {
        platformFee: platformFee,
        transferAmount: professionalAmount
      };
      await booking.save();

      // Notify professional
      await Notification.create({
        user: booking.professionalId._id,
        type: 'booking-confirmed',
        title: '✅ Booking Confirmed (COD)',
        message: `${booking.customerId.name} confirmed booking for ${booking.serviceId.name}. Payment: Cash on Delivery (₹${amount})`,
        priority: 'high',
        data: { bookingId: booking._id }
      });

      // Notify customer
      await Notification.create({
        user: booking.customerId._id,
        type: 'booking-confirmed',
        title: '✅ Booking Confirmed!',
        message: `Your booking for ${booking.serviceId.name} with ${booking.professionalId.name} is confirmed. Pay ₹${amount} in cash after service.`,
        priority: 'high',
        data: { bookingId: booking._id }
      });

      const io = req.app.get('io');
      if (io) {
        // Notify professional
        io.to(`user-${booking.professionalId._id}`).emit('booking-confirmed', {
          bookingId: booking._id,
          paymentMethod: 'cash',
          customerName: booking.customerId.name,
          timestamp: new Date()
        });
        
        // Notify customer
        io.to(`user-${booking.customerId._id}`).emit('booking-confirmed', {
          bookingId: booking._id,
          paymentMethod: 'cash',
          professionalName: booking.professionalId.name,
          timestamp: new Date()
        });
        
        // Broadcast booking update
        io.to(`booking-${booking._id}`).emit('booking-status-update', {
          bookingId: booking._id,
          status: 'confirmed',
          paymentMethod: 'cash',
          timestamp: new Date()
        });
      }

      return res.json({
        success: true,
        message: 'Booking confirmed! Pay cash after service completion.',
        bookingId: booking._id
      });
    }

    // Handle ONLINE PAYMENT (Stripe)
    if (paymentMethod === 'online' || paymentMethod === 'card') {
      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: booking.serviceId.name,
                description: `Professional service by ${booking.professionalId.name}`,
                images: ['https://i.imgur.com/EHyR2nP.png'],
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/bookings/${booking._id}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/bookings/${booking._id}/payment?payment=cancelled`,
        customer_email: booking.customerId.email || undefined,
        metadata: {
          bookingId: booking._id.toString(),
          professionalId: booking.professionalId._id.toString(),
          customerId: booking.customerId._id.toString()
        }
      });

      // Store session ID temporarily
      booking.paymentDetails = {
        stripeSessionId: session.id,
        platformFee: platformFee,
        transferAmount: professionalAmount
      };
      await booking.save();

      return res.json({
        success: true,
        sessionUrl: session.url
      });
    }

    return res.status(400).json({ error: 'Invalid payment method' });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Stripe payment success callback
router.get('/:bookingId/payment-success', isAuthenticated, async (req, res) => {
  try {
    const { session_id } = req.query;
    const booking = await Booking.findById(req.params.bookingId)
      .populate('customerId')
      .populate('professionalId')
      .populate('serviceId');

    if (!booking) {
      return res.redirect('/bookings?error=booking-not-found');
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      const amount = session.amount_total / 100;
      const platformFeePercent = 10;
      const platformFee = (amount * platformFeePercent) / 100;
      const professionalAmount = amount - platformFee;

      // Update booking
      booking.paymentStatus = 'completed';
      booking.paymentMethod = 'online';
      booking.status = 'confirmed';
      booking.paymentDetails = {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        paidAt: new Date(),
        platformFee: platformFee,
        transferAmount: professionalAmount
      };

      // Transfer to professional if Stripe Connect is set up
      if (booking.professionalId.stripeAccountId && booking.professionalId.stripeOnboardingComplete) {
        try {
          const transfer = await stripe.transfers.create({
            amount: Math.round(professionalAmount * 100),
            currency: 'inr',
            destination: booking.professionalId.stripeAccountId,
            description: `Payment for booking #${booking._id}`,
            metadata: {
              bookingId: booking._id.toString(),
              professionalId: booking.professionalId._id.toString()
            },
            source_transaction: session.payment_intent
          });

          booking.paymentDetails.stripeTransferId = transfer.id;
          booking.paymentDetails.transferredToProfessional = true;
          booking.paymentDetails.transferredAt = new Date();

          console.log(`✅ Transferred ₹${professionalAmount} to ${booking.professionalId.name}`);
        } catch (transferError) {
          console.error('Transfer error:', transferError);
          booking.paymentDetails.transferredToProfessional = false;
        }
      } else {
        booking.paymentDetails.transferredToProfessional = false;
        console.log('⚠️ Professional payout account not set up - transfer pending');
      }

      await booking.save();

      // Notify professional
      await Notification.create({
        user: booking.professionalId._id,
        type: 'payment-received',
        title: '💰 Payment Received!',
        message: `${booking.customerId.name} paid ₹${professionalAmount} for ${booking.serviceId.name}. Booking confirmed!`,
        priority: 'high',
        data: { bookingId: booking._id }
      });

      // Notify customer
      await Notification.create({
        user: booking.customerId._id,
        type: 'payment-success',
        title: '✅ Payment Successful!',
        message: `Your payment of ₹${amount} for ${booking.serviceId.name} is confirmed. Booking confirmed!`,
        priority: 'high',
        data: { bookingId: booking._id }
      });

      const io = req.app.get('io');
      if (io) {
        // Notify professional
        io.to(`user-${booking.professionalId._id}`).emit('payment-received', {
          bookingId: booking._id,
          amount: professionalAmount,
          customerName: booking.customerId.name,
          timestamp: new Date()
        });
        
        // Notify customer
        io.to(`user-${booking.customerId._id}`).emit('payment-confirmed', {
          bookingId: booking._id,
          amount: amount,
          professionalName: booking.professionalId.name,
          timestamp: new Date()
        });
        
        // Broadcast booking update
        io.to(`booking-${booking._id}`).emit('booking-status-update', {
          bookingId: booking._id,
          status: 'confirmed',
          paymentStatus: 'completed',
          timestamp: new Date()
        });
      }

      res.redirect(`/bookings/${booking._id}?payment=success`);
    } else {
      res.redirect(`/bookings/${booking._id}/payment?payment=pending`);
    }
  } catch (error) {
    console.error('Payment success error:', error);
    res.redirect('/bookings?error=payment-verification-failed');
  }
});

module.exports = router;
