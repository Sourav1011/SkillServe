// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  
  if (hamburger) {
    hamburger.addEventListener('click', function() {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });
  }
  
  // Auto-hide alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Load saved city
  const savedCity = localStorage.getItem('selectedCity');
  if (savedCity && document.querySelector('.current-city')) {
    document.querySelector('.current-city').textContent = savedCity;
  }

  // Initialize modals and UI components
  initSubcategoryTabs();
});

// Subcategory Tabs
function initSubcategoryTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const subcategory = btn.dataset.subcategory;
      filterServicesBySubcategory(subcategory);
    });
  });
}

function filterServicesBySubcategory(subcategory) {
  const serviceItems = document.querySelectorAll('.service-list-item');
  
  if (subcategory === 'all') {
    serviceItems.forEach(item => item.style.display = 'flex');
    return;
  }
  
  serviceItems.forEach(item => {
    const itemSubcategory = item.dataset.subcategory;
    item.style.display = itemSubcategory === subcategory ? 'flex' : 'none';
  });
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
