// Booking Wizard JavaScript

// Booking data
const bookingData = {
  serviceId: null,
  servicePrice: 0,
  serviceCategory: null,
  date: null,
  time: null,
  professionalId: null,
  professionalName: null,
  address: {},
  paymentMethod: null,
  currentStep: 1
};

// Stripe Elements
let stripe = null;
let cardElement = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const serviceData = document.getElementById('serviceData');
  if (serviceData) {
    bookingData.serviceId = serviceData.dataset.serviceId;
    bookingData.servicePrice = parseFloat(serviceData.dataset.servicePrice);
    bookingData.serviceCategory = serviceData.dataset.serviceCategory;
  }
  
  generateDateGrid();
  generateTimeGrid();
  updateProgress();
  initializeStripe();
});

// Initialize Stripe
function initializeStripe() {
  // Stripe will be initialized when payment method is selected
  console.log('Stripe initialization ready');
}

// Setup Stripe Elements when online payment is selected
function setupStripeElements(publishableKey) {
  if (!stripe) {
    stripe = Stripe(publishableKey);
    const elements = stripe.elements();
    
    cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#32325d',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          '::placeholder': {
            color: '#aab7c4'
          }
        },
        invalid: {
          color: '#e74c3c',
          iconColor: '#e74c3c'
        }
      }
    });
    
    cardElement.mount('#card-element');
    
    cardElement.on('change', (event) => {
      const displayError = document.getElementById('card-errors');
      if (event.error) {
        displayError.textContent = event.error.message;
      } else {
        displayError.textContent = '';
      }
    });
    
    console.log('Stripe Elements initialized');
  }
}

// Generate date grid (next 14 days)
function generateDateGrid() {
  const dateGrid = document.getElementById('dateGrid');
  if (!dateGrid) return;
  
  dateGrid.innerHTML = '';
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[date.getDay()];
    const dateNum = date.getDate();
    const monthName = monthNames[date.getMonth()];
    const fullDate = date.toISOString().split('T')[0];
    
    const dateCard = document.createElement('div');
    dateCard.className = 'date-card';
    dateCard.dataset.date = fullDate;
    dateCard.innerHTML = `
      <span class="day">${dayName}</span>
      <span class="date">${dateNum}</span>
      <span class="month">${monthName}</span>
    `;
    
    dateCard.addEventListener('click', () => selectDate(dateCard, fullDate));
    dateGrid.appendChild(dateCard);
  }
}

// Select date
function selectDate(element, date) {
  document.querySelectorAll('.date-card').forEach(card => card.classList.remove('selected'));
  element.classList.add('selected');
  bookingData.date = date;
  validateStep1();
}

// Generate time grid
function generateTimeGrid() {
  const timeGrid = document.getElementById('timeGrid');
  if (!timeGrid) return;
  
  const times = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'
  ];
  
  times.forEach(time => {
    const timeSlot = document.createElement('div');
    timeSlot.className = 'time-slot';
    timeSlot.textContent = time;
    timeSlot.dataset.time = time;
    
    timeSlot.addEventListener('click', () => selectTime(timeSlot, time));
    timeGrid.appendChild(timeSlot);
  });
}

// Select time
function selectTime(element, time) {
  document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
  element.classList.add('selected');
  bookingData.time = time;
  validateStep1();
}

// Validate step 1
function validateStep1() {
  const nextBtn = document.getElementById('step1Next');
  if (bookingData.date && bookingData.time) {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = true;
  }
}

// Navigate to next step
function nextStep(step) {
  // Validate current step before proceeding
  if (bookingData.currentStep === 3 && step === 4) {
    const fullAddress = document.getElementById('fullAddress').value.trim();
    const city = document.getElementById('city').value.trim();
    const pincode = document.getElementById('pincode').value.trim();
    
    if (!fullAddress || !city || !pincode) {
      alert('Please fill in all required address fields (Full Address, City, and Pincode)');
      return;
    }
  }
  
  bookingData.currentStep = step;
  
  // Hide all steps
  document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
  
  // Show current step
  document.getElementById(`step${step}`).classList.add('active');
  
  // Update progress
  updateProgress();
  
  // Load data for current step
  if (step === 2) {
    loadProfessionals();
  } else if (step === 5) {
    showSummary();
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Navigate to previous step
function previousStep(step) {
  nextStep(step);
}

// Update progress bar
function updateProgress() {
  const progressFill = document.getElementById('progressFill');
  const progressWidth = ((bookingData.currentStep - 1) / 4) * 100;
  progressFill.style.width = `calc(${progressWidth}% - 2rem)`;
  
  document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
    if (index + 1 < bookingData.currentStep) {
      indicator.classList.add('completed');
      indicator.classList.remove('active');
    } else if (index + 1 === bookingData.currentStep) {
      indicator.classList.add('active');
      indicator.classList.remove('completed');
    } else {
      indicator.classList.remove('active', 'completed');
    }
  });
}

// Load available professionals
async function loadProfessionals() {
  const grid = document.getElementById('professionalsGrid');
  grid.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Finding best professionals for you...</div>';
  
  try {
    const response = await fetch(`/bookings/professionals?category=${bookingData.serviceCategory}&date=${bookingData.date}&time=${bookingData.time}`);
    const professionals = await response.json();
    
    if (professionals.length === 0) {
      grid.innerHTML = `
        <div class="professionals-empty">
          <i class="fas fa-user-slash"></i>
          <h3>No Professionals Available</h3>
          <p>Sorry, no professionals are available for the selected date and time.</p>
          <p style="margin-top: 0.5rem; font-size: 0.9rem;">Try selecting a different time slot to see available professionals.</p>
          <button class="change-slot-btn" onclick="goToStep(1)">
            <i class="fas fa-clock"></i> Change Time Slot
          </button>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = '';
    professionals.forEach(pro => {
      const isOnline = pro.isOnline;
      const rating = pro.rating || 4.5;
      const reviews = pro.totalReviews || 0;
      const experience = pro.experience || 0;
      const isTopRated = rating >= 4.7;
      const isVerified = true; // You can add a verified field to User model
      
      const card = document.createElement('div');
      card.className = 'professional-card';
      card.dataset.id = pro._id;
      card.innerHTML = `
        <div class="professional-avatar-container">
          <img src="${pro.profileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(pro.name) + '&background=random'}" 
               alt="${pro.name}" class="professional-avatar">
          <div class="professional-online-dot ${!isOnline ? 'professional-offline-dot' : ''}"></div>
        </div>
        
        <div class="professional-info">
          <div class="professional-header">
            <div class="professional-name-section">
              <h4>${pro.name}</h4>
              <p class="professional-profession">${pro.profession || 'Professional'}</p>
            </div>
            <div class="professional-rating">
              <span class="rating-number">${rating.toFixed(1)}</span>
              <i class="fas fa-star rating-star"></i>
            </div>
          </div>
          
          <div class="professional-details">
            <div class="detail-item">
              <i class="fas fa-briefcase"></i>
              <span><strong>${experience}</strong> years exp.</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-users"></i>
              <span><strong>${reviews}</strong> reviews</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-check-circle"></i>
              <span><strong>100%</strong> jobs completed</span>
            </div>
          </div>
          
          <div class="professional-badges">
            <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}">
              <i class="fas fa-circle"></i>
              ${isOnline ? 'Available Now' : 'Offline'}
            </span>
            ${isVerified ? '<span class="badge badge-verified"><i class="fas fa-shield-check"></i> Verified</span>' : ''}
            ${isTopRated ? '<span class="badge badge-top-rated"><i class="fas fa-award"></i> Top Rated</span>' : ''}
          </div>
        </div>
        
        <div class="selected-badge">
          <i class="fas fa-check"></i>
        </div>
      `;
      
      card.addEventListener('click', () => selectProfessional(card, pro));
      grid.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading professionals:', error);
    grid.innerHTML = `
      <div class="professionals-empty">
        <i class="fas fa-exclamation-circle" style="color: var(--danger-color);"></i>
        <h3>Oops! Something went wrong</h3>
        <p>Unable to load professionals. Please try again.</p>
        <button class="change-slot-btn" onclick="loadProfessionals()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

// Select professional
function selectProfessional(element, professional) {
  document.querySelectorAll('.professional-card').forEach(card => card.classList.remove('selected'));
  element.classList.add('selected');
  
  bookingData.professionalId = professional._id;
  bookingData.professionalName = professional.name;
  
  document.getElementById('step2Next').disabled = false;
}

// Select payment method
function selectPayment(method) {
  document.querySelectorAll('.payment-option').forEach(option => option.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  
  bookingData.paymentMethod = method;
  document.getElementById('step4Next').disabled = false;
}

// Show summary
function showSummary() {
  // Get address form data
  bookingData.address = {
    fullAddress: document.getElementById('fullAddress').value,
    landmark: document.getElementById('landmark').value,
    city: document.getElementById('city').value,
    pincode: document.getElementById('pincode').value,
    notes: document.getElementById('notes').value
  };
  
  // Display date
  const dateObj = new Date(bookingData.date);
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('summaryDate').textContent = dateStr;
  
  // Display time
  document.getElementById('summaryTime').textContent = bookingData.time;
  
  // Display professional
  document.getElementById('summaryProfessional').textContent = bookingData.professionalName;
  
  // Display address
  const addressStr = `${bookingData.address.fullAddress}, ${bookingData.address.city} - ${bookingData.address.pincode}`;
  document.getElementById('summaryAddress').textContent = addressStr;
  
  // Display payment method
  const paymentMethods = {
    wallet: 'Wallet Payment',
    cash: 'Cash on Service',
    online: 'Online Payment'
  };
  document.getElementById('summaryPayment').textContent = paymentMethods[bookingData.paymentMethod];
}

// Confirm booking
async function confirmBooking() {
  const button = event.target;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  
  try {
    // Create booking request (NO PAYMENT YET - professional must accept first)
    const response = await fetch('/bookings/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Show success message
      alert('✅ Booking request sent! You will be notified when the professional accepts. Payment will be required after acceptance.');
      
      // Redirect to booking details
      window.location.href = `/bookings/${result.bookingId}`;
    } else {
      throw new Error(result.error || 'Booking failed');
    }
  } catch (error) {
    console.error('Error creating booking:', error);
    alert('Failed to create booking. Please try again.');
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Booking';
  }
}

// Process online payment with Stripe (REMOVED - payment happens AFTER professional accepts)
async function processOnlinePayment(button) {
  // This function is now obsolete - payment is triggered by professional acceptance
  console.log('Payment will be processed after professional accepts');
}

// Helper function to go to a specific step
function goToStep(step) {
  nextStep(step);
}
