const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { isAuthenticated } = require('../middleware/auth');

// Get all notifications for user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.render('notifications/list', {
      title: 'Notifications',
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    req.session.error = 'Error loading notifications';
    res.redirect('/');
  }
});

// Get unread notifications count
router.get('/unread/count', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    const count = await Notification.countDocuments({
      user: userId,
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Error fetching unread count' });
  }
});

// Get unread notifications
router.get('/unread', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    const notifications = await Notification.find({
      user: userId,
      isRead: false
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

// Mark notification as read
router.post('/:id/read', isAuthenticated, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Error updating notification' });
  }
});

// Mark all as read
router.post('/read-all', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user._id;
    await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Error updating notifications' });
  }
});

// Delete notification
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Error deleting notification' });
  }
});

// Create notification (helper function for other routes)
async function createNotification(userId, type, title, message, data = {}) {
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      data
    });
    await notification.save();

    // Emit via socket
    const io = global.io;
    if (io) {
      io.to(`user-${userId}`).emit('new-notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
