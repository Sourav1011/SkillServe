const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const totalServices = await Service.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProfessionals = await User.countDocuments({ role: 'professional' });
    
    // Revenue calculation
    const completedBookings = await Booking.find({ status: 'completed' });
    const totalRevenue = completedBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    
    // Status breakdown
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const completedCount = await Booking.countDocuments({ status: 'completed' });
    const cancelledCount = await Booking.countDocuments({ status: 'cancelled' });
    
    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('customer', 'name email phone')
      .populate('service', 'name category price')
      .populate('professional', 'name phone')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Top services
    const topServices = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: '$service', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'serviceInfo' } },
      { $unwind: '$serviceInfo' }
    ]);
    
    res.render('admin/dashboard', { 
      title: 'Admin Dashboard',
      stats: {
        totalServices,
        totalBookings,
        totalCustomers,
        totalProfessionals,
        totalRevenue,
        pendingBookings,
        confirmedBookings,
        completedCount,
        cancelledCount
      },
      recentBookings,
      topServices
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load dashboard' 
    });
  }
});

// Manage services
router.get('/services', isAdmin, async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    const totalServices = await Service.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    
    res.render('admin/services', { 
      title: 'Manage Services',
      services,
      stats: {
        totalServices,
        pendingBookings
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load services' 
    });
  }
});

// Add service page
router.get('/services/add', isAdmin, (req, res) => {
  res.render('admin/add-service', { title: 'Add Service' });
});

// Add service handler
router.post('/services/add', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, price, duration, features } = req.body;
    
    const service = new Service({
      name,
      category,
      description,
      price,
      duration,
      features: features ? features.split(',').map(f => f.trim()) : []
    });
    
    if (req.file) {
      service.image = '/uploads/' + req.file.filename;
    }
    
    await service.save();
    
    req.session.success = 'Service added successfully';
    res.redirect('/admin/services');
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to add service';
    res.redirect('/admin/services/add');
  }
});

// Edit service page
router.get('/services/edit/:id', isAdmin, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    res.render('admin/edit-service', { 
      title: 'Edit Service',
      service 
    });
  } catch (error) {
    console.error(error);
    req.session.error = 'Service not found';
    res.redirect('/admin/services');
  }
});

// Update service
router.post('/services/edit/:id', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, price, duration, features, active } = req.body;
    const service = await Service.findById(req.params.id);
    
    service.name = name;
    service.category = category;
    service.description = description;
    service.price = price;
    service.duration = duration;
    service.features = features ? features.split(',').map(f => f.trim()) : [];
    service.active = active === 'true';
    
    if (req.file) {
      service.image = '/uploads/' + req.file.filename;
    }
    
    await service.save();
    
    req.session.success = 'Service updated successfully';
    res.redirect('/admin/services');
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to update service';
    res.redirect('/admin/services');
  }
});

// Delete service
router.post('/services/delete/:id', isAdmin, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to delete service' });
  }
});

// Toggle service status
router.post('/services/:id/toggle', isAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    await Service.findByIdAndUpdate(req.params.id, { active });
    res.json({ success: true, message: 'Service status updated' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to update service status' });
  }
});

// Manage bookings
router.get('/bookings', isAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer')
      .populate('service')
      .populate('professional')
      .sort({ createdAt: -1 });
    
    const totalServices = await Service.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    
    res.render('admin/bookings', { 
      title: 'Manage Bookings',
      bookings,
      stats: {
        totalServices,
        pendingBookings
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load bookings' 
    });
  }
});

// Assign professional to booking
router.post('/bookings/:id/assign', isAdmin, async (req, res) => {
  try {
    const { professionalId } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    booking.professional = professionalId;
    booking.status = 'assigned';
    await booking.save();
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`booking-${booking._id}`).emit('status-update', {
        bookingId: booking._id,
        status: 'assigned'
      });
    }
    
    res.json({ success: true, message: 'Professional assigned successfully' });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to assign professional' });
  }
});

// Manage users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const totalServices = await Service.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    
    res.render('admin/users', { 
      title: 'Manage Users',
      users,
      stats: {
        totalServices,
        pendingBookings
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load users' 
    });
  }
});

// API: Get real-time stats
router.get('/api/stats', isAdmin, async (req, res) => {
  try {
    const totalServices = await Service.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProfessionals = await User.countDocuments({ role: 'professional' });
    
    const completedBookings = await Booking.find({ status: 'completed' });
    const totalRevenue = completedBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    
    res.json({
      success: true,
      stats: {
        totalServices,
        totalBookings,
        totalCustomers,
        totalProfessionals,
        totalRevenue,
        pendingBookings,
        confirmedBookings
      }
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.json({ success: false, message: 'Failed to fetch stats' });
  }
});

// API: Get recent bookings
router.get('/api/bookings/recent', isAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const bookings = await Booking.find()
      .populate('customer', 'name email')
      .populate('service', 'name category price')
      .populate('professional', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Recent bookings API error:', error);
    res.json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// API: Update booking status
router.patch('/api/bookings/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('customer service professional');
    
    // Emit socket event
    const io = req.app.get('io');
    if (io && booking) {
      io.to(`user-${booking.customer._id}`).emit('status-update', {
        bookingId: booking._id,
        status: booking.status
      });
      
      if (booking.professional) {
        io.to(`user-${booking.professional._id}`).emit('status-update', {
          bookingId: booking._id,
          status: booking.status
        });
      }
    }
    
    res.json({ success: true, message: 'Booking status updated', booking });
  } catch (error) {
    console.error('Update status error:', error);
    res.json({ success: false, message: 'Failed to update status' });
  }
});

// API: Get booking details
router.get('/api/bookings/:id/details', isAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('service', 'name category price')
      .populate('professional', 'name email phone');
    
    if (!booking) {
      return res.json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, booking });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.json({ success: false, message: 'Failed to fetch booking details' });
  }
});

// API: Delete booking
router.delete('/api/bookings/:id', isAdmin, async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.json({ success: false, message: 'Failed to delete booking' });
  }
});

// API: Toggle user status
router.patch('/api/users/:id/toggle', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.verified = !user.verified;
    await user.save();
    
    res.json({ success: true, message: 'User status updated', verified: user.verified });
  } catch (error) {
    console.error('Toggle user error:', error);
    res.json({ success: false, message: 'Failed to update user status' });
  }
});

// API: Delete user
router.delete('/api/users/:id', isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.json({ success: false, message: 'Failed to delete user' });
  }
});

module.exports = router;
