const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Booking = require('../models/Booking');
const { isAuthenticated } = require('../middleware/auth');

// Get unread count (API endpoint)
router.get('/unread-count', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const query = req.session.user.role === 'professional' 
      ? { professional: userId }
      : { customer: userId };

    const chats = await Chat.find(query);
    const unreadCount = chats.reduce((sum, chat) => {
      if (req.session.user.role === 'professional') {
        return sum + (chat.unreadByProfessional || 0);
      } else {
        return sum + (chat.unreadByCustomer || 0);
      }
    }, 0);

    res.json({ count: unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.json({ count: 0 });
  }
});

// Get all chats for a user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const query = req.session.user.role === 'professional' 
      ? { professional: userId }
      : { customer: userId };

    const allChats = await Chat.find(query)
      .populate('customer', 'name profileImage')
      .populate('professional', 'name profileImage')
      .populate('booking', 'scheduledDate scheduledTime status')
      .sort({ lastMessageTime: -1 });

    // Group chats by person - show only the latest chat per person
    const chatMap = new Map();
    allChats.forEach(chat => {
      const personId = req.session.user.role === 'professional' 
        ? chat.customer._id.toString()
        : chat.professional._id.toString();
      
      // Only keep the most recent chat with each person
      if (!chatMap.has(personId)) {
        chatMap.set(personId, chat);
      }
    });

    const chats = Array.from(chatMap.values());

    res.render('chat/list', {
      title: 'My Chats',
      chats,
      userRole: req.session.user.role
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    req.session.error = 'Error loading chats';
    res.redirect('/');
  }
});

// Get specific chat
router.get('/:chatId', isAuthenticated, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .populate('customer', 'name profileImage email phone')
      .populate('professional', 'name profileImage email phone profession')
      .populate('booking');

    if (!chat) {
      req.session.error = 'Chat not found';
      return res.redirect('/chat');
    }

    // Verify user is part of this chat
    const userId = req.session.user.id;
    if (chat.customer._id.toString() !== userId && chat.professional._id.toString() !== userId) {
      req.session.error = 'Unauthorized access';
      return res.redirect('/chat');
    }

    // Mark messages as read
    chat.messages.forEach(msg => {
      if (msg.sender.toString() !== userId) {
        msg.isRead = true;
      }
    });

    if (userId === chat.customer._id.toString()) {
      chat.unreadCount.customer = 0;
    } else {
      chat.unreadCount.professional = 0;
    }

    await chat.save();

    res.render('chat/conversation', {
      title: 'Chat',
      chat,
      currentUserId: userId
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    req.session.error = 'Error loading chat';
    res.redirect('/chat');
  }
});

// Create chat for a booking
router.post('/create/:bookingId', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({ booking: booking._id });
    
    if (!chat) {
      chat = new Chat({
        booking: booking._id,
        customer: booking.customer,
        professional: booking.professional,
        messages: [],
        isActive: true
      });
      await chat.save();
    }

    res.json({ success: true, chatId: chat._id });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Error creating chat' });
  }
});

// Send message (API endpoint)
router.post('/:chatId/message', isAuthenticated, async (req, res) => {
  try {
    const { content, type, fileUrl } = req.body;
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const message = {
      sender: req.session.user.id,
      content,
      type: type || 'text',
      fileUrl,
      isRead: false,
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.lastMessage = content;
    chat.lastMessageTime = new Date();

    // Update unread count
    if (req.session.user.id === chat.customer.toString()) {
      chat.unreadCount.professional += 1;
    } else {
      chat.unreadCount.customer += 1;
    }

    await chat.save();

    // Socket.io will handle real-time update
    const io = req.app.get('io');
    io.to(`chat-${chat._id}`).emit('new-message', {
      chatId: chat._id,
      message: chat.messages[chat.messages.length - 1]
    });

    res.json({ success: true, message: chat.messages[chat.messages.length - 1] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Get unread count
router.get('/unread/count', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    const query = userRole === 'professional' 
      ? { professional: userId }
      : { customer: userId };

    const chats = await Chat.find(query);
    
    const unreadCount = chats.reduce((total, chat) => {
      return total + (userRole === 'professional' 
        ? chat.unreadCount.professional 
        : chat.unreadCount.customer);
    }, 0);

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Error fetching unread count' });
  }
});

module.exports = router;
