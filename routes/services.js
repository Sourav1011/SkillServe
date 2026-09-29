const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// Search API (for real-time search)
router.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const services = await Service.find({
      active: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);
    
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Category page
router.get('/category/:categorySlug', async (req, res) => {
  try {
    const categorySlug = req.params.categorySlug;
    const categoryMap = {
      'salon': 'Salon',
      'cleaning': 'Home Cleaning',
      'ac-repair': 'AC Repair',
      'electrician': 'Electrician',
      'plumbing': 'Plumbing',
      'painting': 'Painting',
      'pest-control': 'Pest Control',
      'appliance-repair': 'Appliance Repair'
    };
    
    const category = categoryMap[categorySlug] || categorySlug;
    const sortBy = req.query.sort || 'popular';
    const minRating = req.query.rating ? parseFloat(req.query.rating) : 0;
    
    let query = { category, active: true };
    if (minRating > 0) {
      query.rating = { $gte: minRating };
    }
    
    let services = await Service.find(query);
    
    // Sorting
    if (sortBy === 'price-low') {
      services = services.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      services = services.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      services = services.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    res.render('services/category', {
      title: category,
      category,
      categorySlug,
      services,
      currentSort: sortBy,
      currentRating: minRating
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load category'
    });
  }
});

// All services
router.get('/', async (req, res) => {
  try {
    const category = req.query.category;
    const query = category ? { category, active: true } : { active: true };
    
    const services = await Service.find(query);
    const categories = await Service.distinct('category');
    
    res.render('services/index', { 
      title: 'Our Services',
      services,
      categories,
      selectedCategory: category || 'All'
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load services' 
    });
  }
});

// Service detail
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).render('404', { title: 'Service Not Found' });
    }
    
    res.render('services/detail', { 
      title: service.name,
      service 
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load service details' 
    });
  }
});

module.exports = router;
