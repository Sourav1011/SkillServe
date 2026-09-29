const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const Booking = require('../models/Booking');
const { isAuthenticated } = require('../middleware/auth');

// Get live location for a booking
router.get('/:bookingId', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('professional', 'name phone profileImage')
      .populate('service', 'name');

    if (!booking) {
      req.session.error = 'Booking not found';
      return res.redirect('/bookings/my-bookings');
    }

    // Verify user is customer of this booking
    if (booking.customer.toString() !== req.session.user._id) {
      req.session.error = 'Unauthorized access';
      return res.redirect('/bookings/my-bookings');
    }

    const location = await Location.findOne({ booking: booking._id })
      .populate('professional', 'name phone');

    res.render('tracking/live', {
      title: 'Track Professional',
      booking,
      location
    });
  } catch (error) {
    console.error('Error loading tracking:', error);
    req.session.error = 'Error loading tracking';
    res.redirect('/bookings/my-bookings');
  }
});

// Update location (for professionals)
router.post('/update/:bookingId', isAuthenticated, async (req, res) => {
  try {
    const { latitude, longitude, address, status, eta, distance } = req.body;
    
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking || booking.professional.toString() !== req.session.user._id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const location = await Location.findOneAndUpdate(
      { booking: booking._id, professional: req.session.user._id },
      {
        currentLocation: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        address,
        status,
        eta: eta ? new Date(eta) : null,
        distance: distance ? parseFloat(distance) : null,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    // Emit via socket
    const io = req.app.get('io');
    io.to(`booking-${booking._id}`).emit('location-update', {
      bookingId: booking._id,
      location: location.currentLocation.coordinates,
      status: location.status,
      eta: location.eta,
      distance: location.distance
    });

    res.json({ success: true, location });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Error updating location' });
  }
});

// Get current location for a booking (API)
router.get('/api/:bookingId/current', isAuthenticated, async (req, res) => {
  try {
    const location = await Location.findOne({ booking: req.params.bookingId })
      .populate('professional', 'name phone profileImage');

    if (!location) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      location: {
        coordinates: location.currentLocation.coordinates,
        address: location.address,
        status: location.status,
        eta: location.eta,
        distance: location.distance,
        lastUpdated: location.lastUpdated,
        professional: location.professional
      }
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Error fetching location' });
  }
});

// Mark as reached
router.post('/:bookingId/reached', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking || booking.professional.toString() !== req.session.user._id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const location = await Location.findOneAndUpdate(
      { booking: booking._id },
      { status: 'reached' },
      { new: true }
    );

    // Emit via socket
    const io = req.app.get('io');
    io.to(`booking-${booking._id}`).emit('professional-reached', {
      bookingId: booking._id,
      professionalId: req.session.user._id,
      message: 'Your professional has arrived!'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as reached:', error);
    res.status(500).json({ error: 'Error updating status' });
  }
});

// Start service
router.post('/:bookingId/start', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking || booking.professional.toString() !== req.session.user._id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    booking.status = 'in-progress';
    await booking.save();

    await Location.findOneAndUpdate(
      { booking: booking._id },
      { status: 'working' }
    );

    // Emit via socket
    const io = req.app.get('io');
    io.to(`booking-${booking._id}`).emit('service-status', {
      bookingId: booking._id,
      status: 'in-progress',
      message: 'Service has been started'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error starting service:', error);
    res.status(500).json({ error: 'Error updating status' });
  }
});

module.exports = router;
