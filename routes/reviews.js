const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get all reviews for a professional
router.get('/professional/:professionalId', async (req, res) => {
  try {
    const reviews = await Review.find({ professional: req.params.professionalId })
      .populate('customer', 'name profileImage')
      .populate('service', 'name')
      .sort({ createdAt: -1 });

    const professional = await User.findById(req.params.professionalId);

    res.render('reviews/professional', {
      title: `Reviews - ${professional.name}`,
      reviews,
      professional
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    req.session.error = 'Error loading reviews';
    res.redirect('/');
  }
});

// Get review form for a booking
router.get('/create/:bookingId', isAuthenticated, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('service')
      .populate('professional', 'name profileImage');

    if (!booking) {
      req.session.error = 'Booking not found';
      return res.redirect('/bookings/my-bookings');
    }

    if (booking.customer.toString() !== req.session.user._id) {
      req.session.error = 'Unauthorized access';
      return res.redirect('/bookings/my-bookings');
    }

    if (booking.status !== 'completed') {
      req.session.error = 'Can only review completed bookings';
      return res.redirect('/bookings/my-bookings');
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ booking: booking._id });
    if (existingReview) {
      req.session.error = 'You have already reviewed this booking';
      return res.redirect(`/reviews/${existingReview._id}`);
    }

    res.render('reviews/create', {
      title: 'Write a Review',
      booking
    });
  } catch (error) {
    console.error('Error loading review form:', error);
    req.session.error = 'Error loading review form';
    res.redirect('/bookings/my-bookings');
  }
});

// Submit review
router.post('/create/:bookingId', isAuthenticated, upload.array('images', 5), async (req, res) => {
  try {
    const { rating, comment, punctuality, professionalism, quality, cleanliness } = req.body;
    
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking || booking.customer.toString() !== req.session.user._id) {
      req.session.error = 'Unauthorized access';
      return res.redirect('/bookings/my-bookings');
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ booking: booking._id });
    if (existingReview) {
      req.session.error = 'You have already reviewed this booking';
      return res.redirect(`/reviews/${existingReview._id}`);
    }

    const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const review = new Review({
      booking: booking._id,
      customer: req.session.user._id,
      professional: booking.professional,
      service: booking.service,
      rating: parseInt(rating),
      comment,
      aspects: {
        punctuality: parseInt(punctuality) || rating,
        professionalism: parseInt(professionalism) || rating,
        quality: parseInt(quality) || rating,
        cleanliness: parseInt(cleanliness) || rating
      },
      images
    });

    await review.save();

    // Update booking with review
    booking.rating = parseInt(rating);
    booking.review = comment;
    await booking.save();

    // Update professional's rating
    const professional = await User.findById(booking.professional);
    const allReviews = await Review.find({ professional: professional._id });
    
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    professional.rating = totalRating / allReviews.length;
    professional.totalReviews = allReviews.length;
    await professional.save();

    req.session.success = 'Review submitted successfully!';
    res.redirect(`/reviews/${review._id}`);
  } catch (error) {
    console.error('Error creating review:', error);
    req.session.error = 'Error submitting review';
    res.redirect('/bookings/my-bookings');
  }
});

// Get specific review
router.get('/:reviewId', async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId)
      .populate('customer', 'name profileImage')
      .populate('professional', 'name profileImage profession')
      .populate('service', 'name category')
      .populate('booking', 'scheduledDate');

    if (!review) {
      req.session.error = 'Review not found';
      return res.redirect('/');
    }

    res.render('reviews/detail', {
      title: 'Review Details',
      review
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    req.session.error = 'Error loading review';
    res.redirect('/');
  }
});

// Mark review as helpful
router.post('/:reviewId/helpful', isAuthenticated, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user already marked as helpful
    const alreadyMarked = review.helpfulUsers.includes(req.session.user._id);
    
    if (alreadyMarked) {
      // Remove helpful
      review.helpful -= 1;
      review.helpfulUsers = review.helpfulUsers.filter(
        id => id.toString() !== req.session.user._id
      );
    } else {
      // Add helpful
      review.helpful += 1;
      review.helpfulUsers.push(req.session.user._id);
    }

    await review.save();

    res.json({ 
      success: true, 
      helpful: review.helpful,
      userMarked: !alreadyMarked
    });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ error: 'Error updating review' });
  }
});

// Professional response to review
router.post('/:reviewId/response', isAuthenticated, async (req, res) => {
  try {
    const { comment } = req.body;
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.professional.toString() !== req.session.user._id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    review.response = {
      comment,
      date: new Date()
    };

    await review.save();

    req.session.success = 'Response posted successfully';
    res.json({ success: true });
  } catch (error) {
    console.error('Error posting response:', error);
    res.status(500).json({ error: 'Error posting response' });
  }
});

// Get reviews by service
router.get('/service/:serviceId', async (req, res) => {
  try {
    const reviews = await Review.find({ service: req.params.serviceId })
      .populate('customer', 'name profileImage')
      .populate('professional', 'name')
      .sort({ createdAt: -1 });

    res.json({ reviews });
  } catch (error) {
    console.error('Error fetching service reviews:', error);
    res.status(500).json({ error: 'Error fetching reviews' });
  }
});

module.exports = router;
