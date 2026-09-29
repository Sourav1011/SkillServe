const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// Favicon route
router.get('/favicon.ico', (req, res) => res.status(204).end());

// Home page
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ active: true }).limit(8);
    res.render('index', { 
      title: 'SkillServe - Home Services at Your Doorstep',
      services 
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Failed to load services' 
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', { title: 'About Us' });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us' });
});

module.exports = router;
