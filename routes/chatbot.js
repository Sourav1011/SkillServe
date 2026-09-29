const express = require('express');
const router = express.Router();
const chatbot = require('../utils/chatbot');
const { isAuthenticated } = require('../middleware/auth');

// Chatbot conversation endpoint
router.post('/message', isAuthenticated, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const context = {
      userId: req.session.user._id,
      userName: req.session.user.name,
      userRole: req.session.user.role
    };

    const response = await chatbot.getResponse(message, context);
    const quickReplies = chatbot.getQuickReplies('default');

    res.json({
      success: true,
      response,
      quickReplies,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      error: 'Sorry, I encountered an error. Please try again or contact support.'
    });
  }
});

// Get chatbot widget
router.get('/widget', (req, res) => {
  res.render('chatbot/widget', {
    title: 'Chat Assistant'
  });
});

module.exports = router;
