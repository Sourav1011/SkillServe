const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isGuest } = require('../middleware/auth');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone || phone.length !== 10) {
      return res.json({ success: false, message: 'Invalid phone number' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with 5-minute expiration
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    
    // In production, send SMS via Twilio/SMS Gateway
    console.log(`OTP for ${phone}: ${otp}`);
    
    // For development, return success
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // Remove this in production - only for development
      dev_otp: otp
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.json({ success: false, message: 'Failed to send OTP' });
  }
});

// Verify OTP and login
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    // Check if OTP exists
    const stored = otpStore.get(phone);
    if (!stored) {
      return res.json({ success: false, message: 'OTP expired or not found' });
    }
    
    // Check if OTP is expired
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(phone);
      return res.json({ success: false, message: 'OTP expired' });
    }
    
    // Verify OTP
    if (stored.otp !== otp) {
      return res.json({ success: false, message: 'Invalid OTP' });
    }
    
    // Clear OTP
    otpStore.delete(phone);
    
    // Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.json({ success: false, message: 'User not found. Please register first.' });
    }
    
    // Create session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };
    
    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.json({ success: false, message: 'Verification failed' });
  }
});

// Register with OTP
router.post('/register', async (req, res) => {
  try {
    const { name, phone, role, otp } = req.body;
    
    // Verify OTP first
    const stored = otpStore.get(phone);
    if (!stored || stored.otp !== otp || Date.now() > stored.expiresAt) {
      return res.json({ success: false, message: 'Invalid or expired OTP' });
    }
    
    // Clear OTP
    otpStore.delete(phone);
    
    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.json({ success: false, message: 'Phone number already registered' });
    }
    
    // Create new user
    const user = new User({
      name,
      phone,
      email: `${phone}@skillserve.com`, // Generate email from phone
      password: Math.random().toString(36).slice(-8), // Random password (OTP-based login)
      role: role || 'customer',
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2E3192&color=fff&size=200`
    });
    
    await user.save();
    
    // Create session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };
    
    res.json({ success: true, message: 'Registration successful' });
  } catch (error) {
    console.error('Register error:', error);
    res.json({ success: false, message: 'Registration failed' });
  }
});

// Login page
router.get('/login', isGuest, (req, res) => {
  res.render('auth/login', { title: 'Login' });
});

// Login handler
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('========== LOGIN ATTEMPT ==========');
    console.log('Email:', email);
    console.log('Session before login:', req.session);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      req.session.error = 'Invalid email or password';
      return res.redirect('/?error=invalid_credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch for:', email);
      req.session.error = 'Invalid email or password';
      return res.redirect('/?error=invalid_password');
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };

    req.session.success = 'Login successful';
    
    console.log('✅ Login successful');
    console.log('User role:', user.role);
    console.log('Session after setting user:', req.session.user);
    
    // Save session before redirect to ensure it's persisted
    req.session.save((err) => {
      if (err) {
        console.error('❌ Session save error:', err);
        return res.redirect('/?error=session_error');
      }
      
      console.log('✅ Session saved successfully');
      console.log('Session ID:', req.sessionID);
      
      // Redirect based on role
      const redirectUrl = user.role === 'admin' ? '/admin/dashboard' 
                        : user.role === 'professional' ? '/profile/professional' 
                        : '/';
      
      console.log('Redirecting to:', redirectUrl);
      console.log('===================================\n');
      
      res.redirect(redirectUrl);
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    req.session.error = 'An error occurred';
    res.redirect('/?error=server_error');
  }
});

// Simple email/password registration
router.post('/register-email', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    
    console.log('Registration attempt:', email, role); // Debug log
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      console.log('User already exists:', email); // Debug log
      req.session.error = 'Email or phone already registered';
      return res.redirect('/?error=user_exists');
    }
    
    // Create new user
    const user = new User({
      name,
      email,
      password, // Will be hashed by pre-save hook
      phone: phone || '0000000000',
      role: role || 'customer',
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2E3192&color=fff&size=200`
    });
    
    await user.save();
    
    console.log('User created successfully:', email); // Debug log
    
    // Create session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    };
    
    req.session.success = 'Registration successful! Welcome to SkillServe.';
    
    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/?error=session_error');
      }
      
      // Redirect based on role
      if (user.role === 'professional') {
        res.redirect('/profile/professional');
      } else {
        res.redirect('/');
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    req.session.error = 'Registration failed. Please try again.';
    res.redirect('/?error=registration_failed');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
