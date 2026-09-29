const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Wallet = require('../models/Wallet');
const Chat = require('../models/Chat');
const { isAuthenticated, isCustomer } = require('../middleware/auth');

// Wizard booking page
router.get('/wizard/:serviceId', isAuthenticated, async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    
    if (!service) {
      req.session.error = 'Service not found';
      return res.redirect('/services');
    }
    
    res.render('bookings/wizard', { 
      title: `Book ${service.name}`,
      service 
    });
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to load booking page';
    res.redirect('/services');
  }
});

// Get available professionals for service
router.get('/professionals', isAuthenticated, async (req, res) => {
  try {
    const { category, date, time } = req.query;
    
    // Find professionals who:
    // 1. Offer this service category
    // 2. Are currently available (isAvailable = true)
    // 3. Match working schedule for requested date/time
    const query = {
      role: 'professional',
      serviceCategories: category,
      'availability.isAvailable': true  // CRITICAL: Only show available professionals
    };
    
    let professionals = await User.find(query)
      .select('name profileImage rating totalReviews experience isOnline profession availability');
    
    // Further filter by date/time availability if provided
    if (date && time && professionals.length > 0) {
      const requestDate = new Date(date);
      const dayName = requestDate.toLocaleDateString('en-US', { weekday: 'long' });
      const requestTime = time; // Format: "10:00"
      
      professionals = professionals.filter(prof => {
        const avail = prof.availability;
        
        // Check if professional works on this day
        if (avail.workingDays && avail.workingDays.length > 0) {
          if (!avail.workingDays.includes(dayName)) {
            return false;
          }
        }
        
        // Check if date is blocked
        if (avail.blockedDates && avail.blockedDates.length > 0) {
          const isBlocked = avail.blockedDates.some(blocked => {
            const blockedDate = new Date(blocked.date);
            return blockedDate.toDateString() === requestDate.toDateString();
          });
          if (isBlocked) return false;
        }
        
        // Check if time slot is available
        if (avail.timeSlots && avail.timeSlots.length > 0) {
          const hasAvailableSlot = avail.timeSlots.some(slot => {
            return slot.available && slot.start <= requestTime && slot.end >= requestTime;
          });
          if (!hasAvailableSlot) return false;
        }
        
        // Check max bookings per day
        if (avail.maxBookingsPerDay) {
          // This would require checking existing bookings for the date
          // For now, we allow it if isAvailable is true
        }
        
        return true;
      });
    }
    
    res.json(professionals);
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
});

// Create booking (new wizard workflow)
router.post('/create', isAuthenticated, async (req, res) => {
  try {
    const { 
      serviceId, 
      date, 
      time, 
      professionalId, 
      address, 
      paymentMethod,
      servicePrice
    } = req.body;
    
    // Validate session
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: 'User session not found. Please login again.' });
    }
    
    const service = await Service.findById(serviceId);
    const professional = await User.findById(professionalId);
    const customer = await User.findById(req.session.user.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer account not found. Please login again.' });
    }
    
    if (!service || !professional) {
      return res.status(404).json({ error: 'Service or professional not found' });
    }

    if (!address || !address.fullAddress || !address.city || !address.pincode) {
      return res.status(400).json({ error: 'Complete address is required' });
    }
    
    // Create booking IN PENDING STATE - waiting for professional acceptance
    const addressString = `${address.fullAddress}${address.landmark ? ', ' + address.landmark : ''}, ${address.city} - ${address.pincode}`;
    
    const booking = new Booking({
      customerId: customer._id,
      customer: customer._id,
      professionalId: professional._id,
      professional: professional._id,
      serviceId: service._id,
      service: service._id,
      serviceCategory: service.category,
      scheduledDate: date,
      scheduledTime: time,
      address: addressString,
      notes: address.notes || '',
      totalPrice: service.price,
      totalAmount: service.price,
      paymentMethod: paymentMethod,
      paymentStatus: 'pending', // Payment will happen AFTER professional accepts
      status: 'pending' // Waiting for professional acceptance
    });
    
    await booking.save();
    
    // NO PAYMENT YET - Just notify professional about booking request
    
    // Create chat for this booking
    const chat = new Chat({
      customer: customer._id,
      professional: professional._id,
      booking: booking._id,
      messages: [{
        sender: customer._id,
        content: `Hi ${professional.name}, I've requested ${service.name} for ${date} at ${time}. Please accept to proceed.`,
        timestamp: new Date()
      }]
    });
    await chat.save();
    
    // Send notification to professional
    const notification = new Notification({
      user: professional._id,
      type: 'booking',
      title: '🔔 New Booking Request!',
      message: `${customer.name} wants to book ${service.name} for ${date} at ${time}. Accept or decline.`,
      data: {
        bookingId: booking._id,
        customerId: customer._id,
        serviceId: service._id
      }
    });
    await notification.save();
    
    // Send real-time notification via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${professional._id}`).emit('notification', {
        type: 'booking-request',
        title: '🔔 New Booking Request!',
        message: `${customer.name} wants to book ${service.name}`,
        bookingId: booking._id,
        timestamp: new Date()
      });
      
      io.to(`user-${professional._id}`).emit('new-booking', {
        bookingId: booking._id,
        customer: {
          id: customer._id,
          name: customer.name,
          image: customer.profileImage
        },
        service: service.name,
        date: date,
        time: time,
        amount: service.price
      });
    }
    
    // Notify customer about successful request
    const customerNotification = new Notification({
      user: customer._id,
      type: 'booking-request',
      title: '⏳ Booking Request Sent!',
      message: `Your request for ${service.name} on ${date} at ${time} has been sent to ${professional.name}. Waiting for acceptance.`,
      data: {
        bookingId: booking._id,
        professionalId: professional._id,
        serviceId: service._id
      }
    });
    await customerNotification.save();
    
    if (io) {
      io.to(`user-${customer._id}`).emit('notification', {
        type: 'booking-request-sent',
        title: '⏳ Request Sent!',
        message: `Waiting for ${professional.name} to accept your booking`,
        bookingId: booking._id,
        timestamp: new Date()
      });
    }
    
    res.json({ 
      success: true, 
      bookingId: booking._id,
      message: 'Booking request sent to professional. Please wait for acceptance.',
      status: 'pending' // Professional needs to accept first
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// My bookings
router.get('/my-bookings', isAuthenticated, async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.session.user.id })
      .populate('service')
      .populate('professional')
      .sort({ createdAt: -1 });
    
    res.render('bookings/my-bookings', { 
      title: 'My Bookings',
      bookings 
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load bookings' 
    });
  }
});

// Booking detail
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service')
      .populate('professional')
      .populate('customer');
    
    if (!booking) {
      return res.status(404).render('404', { title: 'Booking Not Found' });
    }
    
    // Verify user has access to this booking
    if (!req.session.user || (!req.session.user._id && !req.session.user.id)) {
      return res.redirect('/auth/login');
    }
    
    const customerId = booking.customer?._id || booking.customerId;
    const professionalId = booking.professional?._id || booking.professionalId;
    const userId = req.session.user.id || req.session.user._id;
    
    const hasAccess = 
      userId.toString() === customerId?.toString() || 
      userId.toString() === professionalId?.toString() ||
      req.session.user.role === 'admin';
    
    if (!hasAccess) {
      return res.status(403).render('error', { 
        title: 'Access Denied', 
        message: 'You do not have access to this booking' 
      });
    }
    
    res.render('bookings/detail', { 
      title: 'Booking Details',
      booking 
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load booking details' 
    });
  }
});

// Cancel booking
router.post('/:id/cancel', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      req.session.error = 'Booking not found';
      return res.redirect('/bookings/my-bookings');
    }
    
    booking.status = 'cancelled';
    await booking.save();
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(`booking-${booking._id}`).emit('status-update', {
      bookingId: booking._id,
      status: 'cancelled'
    });
    
    req.session.success = 'Booking cancelled successfully';
    res.redirect('/bookings/my-bookings');
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to cancel booking';
    res.redirect('/bookings/my-bookings');
  }
});

// Submit review
router.post('/:id/review', isAuthenticated, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id).populate('professional');
    
    if (!booking) {
      req.session.error = 'Booking not found';
      return res.redirect('/bookings/my-bookings');
    }
    
    booking.rating = rating;
    booking.review = review;
    await booking.save();
    
    // Update professional rating
    if (booking.professional) {
      const professional = await User.findById(booking.professional._id);
      const totalRating = (professional.rating * professional.totalReviews) + parseInt(rating);
      professional.totalReviews += 1;
      professional.rating = totalRating / professional.totalReviews;
      await professional.save();
    }
    
    req.session.success = 'Review submitted successfully';
    res.redirect('/bookings/my-bookings');
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to submit review';
    res.redirect('/bookings/my-bookings');
  }
});

// Accept booking (Professional)
router.post('/:id/accept', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service')
      .populate('customer');
    
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    
    booking.status = 'confirmed';
    booking.professional = req.session.user.id;
    await booking.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      // Notify customer
      io.to(`user-${booking.customer._id}`).emit('booking-accepted', {
        bookingId: booking._id,
        professionalName: req.session.user.name,
        serviceName: booking.service.name,
        status: 'confirmed',
        timestamp: new Date()
      });
      
      // Update booking room
      io.to(`booking-${booking._id}`).emit('status-update', {
        bookingId: booking._id,
        status: 'confirmed',
        professionalId: req.session.user.id
      });
    }
    
    res.json({ success: true, message: 'Booking accepted successfully' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to accept booking' });
  }
});

// Reject booking (Professional)
router.post('/:id/reject', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service')
      .populate('customer');
    
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    
    booking.status = 'cancelled';
    await booking.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      // Notify customer
      io.to(`user-${booking.customer._id}`).emit('booking-rejected', {
        bookingId: booking._id,
        professionalName: req.session.user.name,
        serviceName: booking.service.name,
        status: 'cancelled',
        timestamp: new Date()
      });
      
      // Update booking room
      io.to(`booking-${booking._id}`).emit('status-update', {
        bookingId: booking._id,
        status: 'cancelled'
      });
    }
    
    res.json({ success: true, message: 'Booking declined' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to decline booking' });
  }
});

// Complete booking (Professional)
router.post('/:id/complete', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service')
      .populate('customer')
      .populate('professionalId');
    
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    
    booking.status = 'completed';
    booking.completedAt = new Date();

    // Handle COD payment confirmation
    if (booking.paymentMethod === 'cash' && booking.paymentStatus === 'pending') {
      const { codReceived } = req.body;
      
      if (codReceived) {
        booking.paymentStatus = 'completed';
        booking.codDetails = {
          receivedBy: req.session.user.id, // Professional's ID
          receivedAt: new Date(),
          verifiedByAdmin: false,
          notes: 'Cash collected by professional'
        };
        console.log(`COD payment confirmed: ₹${booking.totalPrice} by ${req.session.user.name}`);
      }
    }

    await booking.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      // Notify customer
      io.to(`user-${booking.customer._id}`).emit('booking-completed', {
        bookingId: booking._id,
        professionalName: req.session.user.name,
        serviceName: booking.service.name,
        status: 'completed',
        timestamp: new Date()
      });
      
      // Update booking room
      io.to(`booking-${booking._id}`).emit('status-update', {
        bookingId: booking._id,
        status: 'completed'
      });
    }
    
    res.json({ success: true, message: 'Booking marked as completed' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to complete booking' });
  }
});

// Update booking status (accept/decline/complete)
router.put('/:bookingId/status', isAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    let bookingId = req.params.bookingId;
    
    console.log('=== Update Booking Status ===');
    console.log('Booking ID (raw):', bookingId);
    console.log('Booking ID type:', typeof bookingId);
    console.log('Booking ID constructor:', bookingId?.constructor?.name);
    console.log('New Status:', status);
    console.log('User ID:', req.session.user?.id || req.session.user?._id);
    console.log('User Role:', req.session.user?.role);
    
    // Fix: If bookingId is somehow an object, convert to string
    if (typeof bookingId === 'object' && bookingId !== null) {
      console.log('WARNING: bookingId is an object, converting...');
      bookingId = bookingId._id || bookingId.toString();
    }
    
    // Validate bookingId is a valid string
    if (!bookingId || typeof bookingId !== 'string') {
      console.log('ERROR: Invalid booking ID format');
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    
    // Additional validation: check if it's a valid ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(bookingId)) {
      console.log('ERROR: Invalid ObjectId format:', bookingId);
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }
    
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('professional')
      .populate('service');
    
    if (!booking) {
      console.log('Booking not found');
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    console.log('Booking Professional ID:', booking.professional?._id);
    
    // Verify user is authorized (professional for this booking or admin)
    const userId = req.session.user.id || req.session.user._id;
    const professionalId = booking.professional?._id?.toString();
    
    if (!professionalId) {
      console.log('ERROR: Professional not populated');
      return res.status(500).json({ error: 'Booking data incomplete' });
    }
    
    if (professionalId !== userId.toString() && req.session.user.role !== 'admin') {
      console.log('Unauthorized: User is not the professional or admin');
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Validate status transition
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'in-progress'];
    if (!validStatuses.includes(status)) {
      console.log('Invalid status:', status);
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // **CRITICAL: Handle ACCEPTANCE - This is when customer must pay!**
    if (status === 'confirmed' && booking.status === 'pending') {
      // Professional accepted - notify customer to make payment
      booking.status = 'awaiting-payment';
      await booking.save();
      
      // Create notification for customer
      await Notification.create({
        user: booking.customer._id,
        type: 'payment-required',
        title: '✅ Booking Accepted - Payment Required',
        message: `${booking.professional.name} accepted your booking! Complete payment to confirm.`,
        priority: 'high',
        data: {
          bookingId: booking._id,
          requiresPayment: true
        }
      });
      
      // Send real-time notification
      const io = req.app.get('io');
      if (io) {
        // Notify customer
        io.to(`user-${booking.customer._id}`).emit('booking-accepted', {
          bookingId: booking._id,
          professionalName: booking.professional.name,
          message: 'Professional accepted! Please complete payment.',
          paymentUrl: `/bookings/${booking._id}/payment`
        });
        
        // Update booking room for both parties
        io.to(`booking-${booking._id}`).emit('status-update', {
          bookingId: booking._id,
          status: 'awaiting-payment'
        });
      }
      
      console.log(`Booking ${booking._id} accepted - customer must pay now`);
      
      return res.json({ 
        success: true, 
        message: 'Booking accepted! Customer will be notified to make payment.',
        booking: {
          id: booking._id,
          status: 'awaiting-payment'
        }
      });
    }
    
    // Handle DECLINE
    if (status === 'cancelled' && booking.status === 'pending') {
      booking.status = 'cancelled';
      booking.cancelledBy = 'professional';
      booking.cancelledAt = new Date();
      await booking.save();
      
      // Notify customer
      await Notification.create({
        user: booking.customer._id,
        type: 'booking-cancelled',
        title: '❌ Booking Declined',
        message: `${booking.professional.name} declined your booking request for ${booking.service.name}.`,
        priority: 'high',
        data: {
          bookingId: booking._id
        }
      });
      
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${booking.customer._id}`).emit('booking-declined', {
          bookingId: booking._id,
          professionalName: booking.professional.name
        });
        
        // Update booking room
        io.to(`booking-${booking._id}`).emit('status-update', {
          bookingId: booking._id,
          status: 'cancelled'
        });
      }
      
      return res.json({ 
        success: true, 
        message: 'Booking declined successfully',
        booking: {
          id: booking._id,
          status: 'cancelled'
        }
      });
    }

    // Update booking status for other cases
    const oldStatus = booking.status;
    booking.status = status;
    
    if (status === 'completed') {
      booking.completedAt = new Date();
    }
    
    await booking.save();
    console.log('Booking status updated successfully');
    
    // Create notification for customer
    let notificationMessage = '';
    let notificationPriority = 'medium';
    
    if (status === 'confirmed') {
      notificationMessage = `${booking.professional.name} confirmed your booking for ${booking.service.name}`;
      notificationPriority = 'high';
    } else if (status === 'cancelled') {
      notificationMessage = `Your booking for ${booking.service.name} has been cancelled`;
      notificationPriority = 'high';
    } else if (status === 'completed') {
      notificationMessage = `Your booking for ${booking.service.name} has been completed`;
      notificationPriority = 'medium';
    }
    
    if (notificationMessage) {
      await Notification.create({
        user: booking.customer._id,
        type: 'booking',
        title: 'Booking Status Updated',
        message: notificationMessage,
        priority: notificationPriority,
        data: {
          bookingId: booking._id
        }
      });
      
      // Send real-time notification via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${booking.customer._id}`).emit('notification', {
          title: 'Booking Status Updated',
          message: notificationMessage,
          type: 'booking'
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Booking ${status} successfully`,
      booking: {
        id: booking._id,
        status: booking.status
      }
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Failed to update booking status', details: error.message });
  }
});

module.exports = router;
