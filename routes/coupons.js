const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Validate and apply coupon
router.post('/validate', isAuthenticated, async (req, res) => {
  try {
    const { code, totalAmount, category } = req.body;
    
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!coupon) {
      return res.json({ valid: false, message: 'Invalid or expired coupon code' });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.json({ valid: false, message: 'Coupon usage limit reached' });
    }

    // Check user usage limit
    const userUsage = coupon.usersUsed.filter(
      u => u.user.toString() === req.session.user._id
    ).length;

    if (userUsage >= coupon.userLimit) {
      return res.json({ valid: false, message: 'You have already used this coupon' });
    }

    // Check minimum order value
    if (totalAmount < coupon.minOrderValue) {
      return res.json({ 
        valid: false, 
        message: `Minimum order value of ₹${coupon.minOrderValue} required` 
      });
    }

    // Check category
    if (coupon.categories.length > 0 && 
        !coupon.categories.includes('All') && 
        !coupon.categories.includes(category)) {
      return res.json({ 
        valid: false, 
        message: 'This coupon is not valid for this service category' 
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (totalAmount * coupon.value) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.value;
    }

    discount = Math.min(discount, totalAmount);

    res.json({
      valid: true,
      discount,
      finalAmount: totalAmount - discount,
      couponId: coupon._id,
      message: `₹${discount} discount applied!`
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ valid: false, message: 'Error validating coupon' });
  }
});

// Apply coupon (mark as used)
router.post('/apply/:couponId', isAuthenticated, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);
    
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    coupon.usedCount += 1;
    coupon.usersUsed.push({
      user: req.session.user._id,
      usedAt: new Date()
    });

    await coupon.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ error: 'Error applying coupon' });
  }
});

// Get available coupons for user
router.get('/available', isAuthenticated, async (req, res) => {
  try {
    const { category } = req.query;
    
    const query = {
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    };

    if (category && category !== 'All') {
      query.$or = [
        { categories: category },
        { categories: 'All' }
      ];
    }

    const coupons = await Coupon.find(query).sort({ value: -1 });

    // Filter coupons based on user usage
    const availableCoupons = coupons.filter(coupon => {
      const userUsage = coupon.usersUsed.filter(
        u => u.user.toString() === req.session.user._id
      ).length;
      
      return userUsage < coupon.userLimit &&
             (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit);
    });

    res.json({ coupons: availableCoupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Error fetching coupons' });
  }
});

// Admin: Create coupon
router.post('/create', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      value,
      maxDiscount,
      minOrderValue,
      categories,
      validFrom,
      validUntil,
      usageLimit,
      userLimit
    } = req.body;

    const coupon = new Coupon({
      code: code.toUpperCase(),
      description,
      type,
      value: parseFloat(value),
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      minOrderValue: parseFloat(minOrderValue) || 0,
      categories: Array.isArray(categories) ? categories : [categories],
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      userLimit: parseInt(userLimit) || 1
    });

    await coupon.save();

    req.session.success = 'Coupon created successfully';
    res.redirect('/admin/coupons');
  } catch (error) {
    console.error('Error creating coupon:', error);
    req.session.error = 'Error creating coupon';
    res.redirect('/admin/coupons');
  }
});

// Admin: Get all coupons
router.get('/admin/list', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Error fetching coupons' });
  }
});

// Admin: Toggle coupon active status
router.post('/:couponId/toggle', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);
    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ success: true, isActive: coupon.isActive });
  } catch (error) {
    console.error('Error toggling coupon:', error);
    res.status(500).json({ error: 'Error updating coupon' });
  }
});

module.exports = router;
