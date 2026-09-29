const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const { isAuthenticated, isProfessional } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Toggle availability
router.post('/toggle-availability', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const user = await User.findById(req.session.user.id);
    
    if (!user.availability) {
      user.availability = {};
    }
    
    user.availability.isAvailable = isAvailable;
    await user.save();
    
    res.json({ success: true, isAvailable });
  } catch (error) {
    console.error('Error toggling availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Customer profile
router.get('/customer', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const bookings = await Booking.find({ customer: user._id })
      .populate('service')
      .populate('professional')
      .sort({ createdAt: -1 });
    
    res.render('profile/customer', { 
      title: 'My Profile',
      user,
      bookings 
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load profile' 
    });
  }
});

// Professional profile
router.get('/professional', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId);
    
    // Get bookings that match professional's service categories
    // OR bookings already assigned to this professional
    const bookings = await Booking.find({
      $or: [
        { professional: user._id },
        { 
          status: 'pending',
          serviceCategory: { $in: user.serviceCategories || [] }
        }
      ]
    })
      .populate('service')
      .populate('customer')
      .sort({ createdAt: -1 });
    
    res.render('profile/professional-new', { 
      title: 'Professional Dashboard',
      user,
      bookings 
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load dashboard' 
    });
  }
});

// Professional Settings Page
router.get('/professional/settings', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('profile/professional-settings', { 
      title: 'Profile Settings',
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load settings' 
    });
  }
});

// Professional Availability Page
router.get('/professional/availability', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('profile/professional-availability', { 
      title: 'Availability Management',
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load availability' 
    });
  }
});

// Professional Earnings Page
router.get('/professional/earnings', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('profile/earnings', { 
      title: 'Earnings & Payouts',
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load earnings' 
    });
  }
});

// Update profile
router.post('/update', isAuthenticated, upload.single('profileImage'), async (req, res) => {
  try {
    const { name, phone, street, city, state, zipCode, profession, experience, serviceCategories } = req.body;
    const user = await User.findById(req.session.user.id);
    
    user.name = name;
    user.phone = phone;
    user.address = { street, city, state, zipCode };
    
    if (user.role === 'professional') {
      user.profession = profession;
      user.experience = experience;
      user.serviceCategories = Array.isArray(serviceCategories) ? serviceCategories : [serviceCategories].filter(Boolean);
    }
    
    if (req.file) {
      user.profileImage = '/uploads/' + req.file.filename;
    }
    
    await user.save();
    
    // Update session
    req.session.user.name = user.name;
    req.session.user.profileImage = user.profileImage;
    
    req.session.success = 'Profile updated successfully';
    
    // Redirect to settings page for professionals, customer profile for customers
    const redirectUrl = user.role === 'professional' ? '/profile/professional/settings' : '/profile/customer';
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to update profile';
    res.redirect('/profile/customer');
  }
});

// Update professional availability
router.post('/professional/availability', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const { workingDays, timeSlots, maxBookingsPerDay, isAvailable } = req.body;
    const user = await User.findById(req.session.user.id);
    
    if (workingDays) user.availability.workingDays = workingDays;
    if (timeSlots) user.availability.timeSlots = timeSlots;
    if (maxBookingsPerDay) user.availability.maxBookingsPerDay = maxBookingsPerDay;
    if (typeof isAvailable !== 'undefined') user.availability.isAvailable = isAvailable;
    
    await user.save();
    
    req.session.success = 'Availability updated successfully';
    res.json({ 
      success: true, 
      message: 'Availability updated successfully',
      availability: user.availability 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
});

// Add blocked date
router.post('/professional/availability/block-date', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const { date, reason } = req.body;
    const user = await User.findById(req.session.user.id);
    
    user.availability.blockedDates.push({ date: new Date(date), reason });
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Date blocked successfully',
      blockedDates: user.availability.blockedDates 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to block date' });
  }
});

// Remove blocked date
router.delete('/professional/availability/block-date/:dateId', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    user.availability.blockedDates = user.availability.blockedDates.filter(
      d => d._id.toString() !== req.params.dateId
    );
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Blocked date removed',
      blockedDates: user.availability.blockedDates 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to remove blocked date' });
  }
});

// Toggle availability status
router.post('/toggle-availability', isAuthenticated, async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const user = await User.findById(req.session.user.id);
    
    if (!user.availability) {
      user.availability = { isAvailable: true };
    }
    
    user.availability.isAvailable = isAvailable;
    await user.save();
    
    // Emit Socket.IO event to notify customers
    const io = req.app.get('io');
    if (io) {
      io.emit('professional-availability-changed', {
        professionalId: user._id,
        professionalName: user.name,
        isAvailable,
        timestamp: new Date()
      });
    }
    
    res.json({ 
      success: true, 
      message: `You are now ${isAvailable ? 'available' : 'unavailable'} for bookings`,
      isAvailable 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
});

// Toggle availability status (PATCH - legacy endpoint)
router.patch('/professional/availability/toggle', isAuthenticated, isProfessional, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    user.availability.isAvailable = !user.availability.isAvailable;
    await user.save();
    
    res.json({ 
      success: true, 
      message: `You are now ${user.availability.isAvailable ? 'available' : 'unavailable'} for bookings`,
      isAvailable: user.availability.isAvailable 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to toggle availability' });
  }
});

module.exports = router;
