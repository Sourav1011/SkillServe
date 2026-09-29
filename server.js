require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const connectDB = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// WebSocket connection
const User = require('./models/User');
const Chat = require('./models/Chat');
const Notification = require('./models/Notification');
const Location = require('./models/Location');

// Store active users and their sockets
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User connects - update online status
  socket.on('user-connected', async (userId) => {
    try {
      // Validate userId
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.log('Invalid userId received:', userId);
        return;
      }
      
      // Validate ObjectId format (24 hex characters)
      if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.log('Invalid ObjectId format:', userId);
        return;
      }
      
      await User.findByIdAndUpdate(userId, { isOnline: true });
      socket.userId = userId;
      socket.join(`user-${userId}`);
      activeUsers.set(userId, socket.id);
      console.log(`User ${userId} is now online`);
      
      // Broadcast online status
      io.emit('user-status-changed', { userId, isOnline: true });
    } catch (error) {
      // Silently fail if database is not available
      if (error.name !== 'MongoServerSelectionError' && error.name !== 'MongoNetworkError') {
        console.error('Error updating user online status:', error.message);
      }
    }
  });

  // Join booking room
  socket.on('join-booking', (bookingId) => {
    socket.join(`booking-${bookingId}`);
    console.log(`Socket ${socket.id} joined booking room: ${bookingId}`);
  });

  // Join chat room
  socket.on('join-chat', (chatId) => {
    socket.join(`chat-${chatId}`);
    console.log(`Socket ${socket.id} joined chat room: ${chatId}`);
  });

  // Join user room (for notifications)
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`Socket ${socket.id} joined user room: ${userId}`);
  });

  // Chat message
  socket.on('send-message', async (data) => {
    try {
      const chat = await Chat.findById(data.chatId);
      if (!chat) return;

      const message = {
        sender: data.senderId,
        content: data.content,
        type: data.type || 'text',
        fileUrl: data.fileUrl,
        isRead: false,
        timestamp: new Date()
      };

      chat.messages.push(message);
      chat.lastMessage = data.content;
      chat.lastMessageTime = new Date();

      // Update unread count
      if (data.senderId.toString() === chat.customer.toString()) {
        chat.unreadCount.professional += 1;
      } else {
        chat.unreadCount.customer += 1;
      }

      await chat.save();

      // Emit to chat room
      io.to(`chat-${data.chatId}`).emit('new-message', {
        chatId: data.chatId,
        message: chat.messages[chat.messages.length - 1]
      });

      // Send notification to recipient
      const recipientId = data.senderId.toString() === chat.customer.toString() 
        ? chat.professional 
        : chat.customer;
      
      io.to(`user-${recipientId}`).emit('notification', {
        type: 'chat',
        message: `New message: ${data.content.substring(0, 50)}...`,
        chatId: data.chatId
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Mark messages as read
  socket.on('mark-read', async (data) => {
    try {
      const chat = await Chat.findById(data.chatId);
      if (!chat) return;

      chat.messages.forEach(msg => {
        if (msg.sender.toString() !== data.userId && !msg.isRead) {
          msg.isRead = true;
        }
      });

      if (data.userId === chat.customer.toString()) {
        chat.unreadCount.customer = 0;
      } else {
        chat.unreadCount.professional = 0;
      }

      await chat.save();
      io.to(`chat-${data.chatId}`).emit('messages-read', { chatId: data.chatId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-typing', {
      userId: data.userId,
      userName: data.userName,
      chatId: data.chatId
    });
  });

  socket.on('stop-typing', (data) => {
    socket.to(`chat-${data.chatId}`).emit('user-stop-typing', {
      userId: data.userId,
      chatId: data.chatId
    });
  });

  // Booking status update
  socket.on('booking-update', (data) => {
    console.log('Booking update:', data);
    io.to(`booking-${data.bookingId}`).emit('status-update', data);
    
    // Notify customer and provider
    if (data.customerId) {
      io.to(`user-${data.customerId}`).emit('notification', {
        type: 'booking-update',
        message: `Your booking status has been updated to ${data.status}`,
        bookingId: data.bookingId
      });
    }
    if (data.providerId) {
      io.to(`user-${data.providerId}`).emit('notification', {
        type: 'booking-update',
        message: `Booking status updated to ${data.status}`,
        bookingId: data.bookingId
      });
    }
  });

  // New booking notification (for providers)
  socket.on('new-booking', (data) => {
    console.log('New booking:', data);
    // Broadcast to all providers of that category
    io.emit('new-booking-notification', data);
  });

  // Location tracking for professionals
  socket.on('update-location', async (data) => {
    try {
      const location = await Location.findOneAndUpdate(
        { booking: data.bookingId, professional: data.professionalId },
        {
          currentLocation: {
            type: 'Point',
            coordinates: [data.longitude, data.latitude]
          },
          address: data.address,
          status: data.status,
          eta: data.eta,
          distance: data.distance,
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );

      // Emit to customer
      io.to(`booking-${data.bookingId}`).emit('location-update', {
        bookingId: data.bookingId,
        location: location.currentLocation.coordinates,
        status: location.status,
        eta: location.eta,
        distance: location.distance
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  // Professional reached location
  socket.on('reached-location', (data) => {
    io.to(`booking-${data.bookingId}`).emit('professional-reached', {
      bookingId: data.bookingId,
      professionalId: data.professionalId,
      message: 'Your professional has arrived!'
    });
  });

  // Service started
  socket.on('service-started', (data) => {
    io.to(`booking-${data.bookingId}`).emit('service-status', {
      bookingId: data.bookingId,
      status: 'in-progress',
      message: 'Service has been started'
    });
  });

  // Service completed
  socket.on('service-completed', (data) => {
    io.to(`booking-${data.bookingId}`).emit('service-status', {
      bookingId: data.bookingId,
      status: 'completed',
      message: 'Service has been completed. Please provide your feedback.'
    });
  });

  // Handle disconnection - update online status
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.userId) {
      try {
        await User.findByIdAndUpdate(socket.userId, { isOnline: false });
        activeUsers.delete(socket.userId);
        io.emit('user-status-changed', { userId: socket.userId, isOnline: false });
        console.log(`User ${socket.userId} is now offline`);
      } catch (error) {
        // Silently fail if database is not available
        if (error.name !== 'MongoServerSelectionError' && error.name !== 'MongoNetworkError') {
          console.error('Error updating user offline status:', error.message);
        }
      }
    }
  });
});

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/services', require('./routes/services'));
app.use('/bookings', require('./routes/booking-payment')); // Payment routes for bookings
app.use('/bookings', require('./routes/bookings'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));
app.use('/payment', require('./routes/payment'));
app.use('/payout', require('./routes/payout'));
app.use('/chat', require('./routes/chat'));
app.use('/notifications', require('./routes/notifications'));
app.use('/wallet', require('./routes/wallet'));
app.use('/reviews', require('./routes/reviews'));
app.use('/coupons', require('./routes/coupons'));
app.use('/tracking', require('./routes/tracking'));
app.use('/chatbot', require('./routes/chatbot'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: 'Page Not Found',
    user: req.session?.user || null
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: 'Error', 
    message: err.message || 'Something went wrong!',
    user: req.session?.user || null
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
