// Professional Dashboard JavaScript

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// Filter chips
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;
    
    // Update active chip
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    // Filter bookings
    document.querySelectorAll('.booking-card').forEach(card => {
      if (filter === 'all') {
        card.style.display = 'block';
      } else {
        const status = card.dataset.status;
        card.style.display = status === filter ? 'block' : 'none';
      }
    });
  });
});

// Handle action buttons with event delegation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  
  const action = btn.dataset.action;
  const bookingId = btn.dataset.booking;
  const userId = btn.dataset.user;
  
  switch(action) {
    case 'accept':
      updateBookingStatus(bookingId, 'confirmed');
      break;
    case 'decline':
      updateBookingStatus(bookingId, 'cancelled');
      break;
    case 'complete':
      updateBookingStatus(bookingId, 'completed');
      break;
    case 'chat':
      openChat(userId);
      break;
  }
});

// Availability toggle
const availabilityToggle = document.getElementById('availabilityToggle');
if (availabilityToggle) {
  availabilityToggle.addEventListener('change', async function() {
    const isAvailable = this.checked;
    
    try {
      const response = await fetch('/profile/toggle-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAvailable })
      });
      
      if (response.ok) {
        showToast(isAvailable ? 'You are now available for bookings' : 'You are not accepting bookings', 'success');
      } else {
        throw new Error('Failed to update availability');
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      this.checked = !isAvailable;
      showToast('Failed to update availability', 'error');
    }
  });
}

// Update booking status
async function updateBookingStatus(bookingId, status) {
  // Ensure bookingId is a clean string without any brackets or formatting
  let id = bookingId;
  
  // If it's an object, try to get the id property
  if (typeof bookingId === 'object' && bookingId !== null) {
    id = bookingId._id || bookingId.id || bookingId.toString();
  }
  
  // Convert to string and remove any whitespace
  id = String(id).trim();
  
  console.log('updateBookingStatus called with:', { original: bookingId, cleaned: id, status });
  
  const confirmMessages = {
    confirmed: 'Are you sure you want to accept this booking?',
    cancelled: 'Are you sure you want to decline this booking?',
    completed: 'Mark this booking as completed?'
  };
  
  if (!confirm(confirmMessages[status])) {
    return;
  }
  
  try {
    const url = `/bookings/${id}/status`;
    console.log('Fetching URL:', url);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Update the booking card UI immediately
      const bookingCard = document.getElementById(`booking-${id}`);
      if (bookingCard) {
        const statusBadge = bookingCard.querySelector('.status-badge');
        if (statusBadge) {
          const newStatus = data.booking.status;
          // Update status text with proper formatting
          const statusText = newStatus.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          statusBadge.textContent = statusText;
          statusBadge.className = `status-badge status-${newStatus}`;
        }
        
        // Update data-status attribute
        bookingCard.setAttribute('data-status', data.booking.status);
        
        // Update action buttons
        const footer = bookingCard.querySelector('.booking-card-footer');
        if (footer && data.booking.status === 'awaiting-payment') {
          footer.innerHTML = '<div class="waiting-payment" style="text-align: center; padding: 1rem; color: #667eea;"><i class="fas fa-clock"></i> Waiting for customer payment...</div>';
        } else if (footer && data.booking.status === 'cancelled') {
          footer.innerHTML = '<div class="booking-cancelled" style="text-align: center; padding: 1rem; color: #e74c3c;"><i class="fas fa-times-circle"></i> Booking declined</div>';
        }
      }
      
      if (status === 'confirmed') {
        showToast('✅ Booking accepted! Customer will be notified to make payment.', 'success');
      } else if (status === 'cancelled') {
        showToast('❌ Booking declined. Customer will be notified.', 'info');
      } else if (status === 'completed') {
        showToast('✅ Booking marked as completed!', 'success');
      }
    } else {
      throw new Error(data.error || 'Failed to update booking');
    }
  } catch (error) {
    console.error('Error updating booking:', error);
    showToast(error.message, 'error');
  }
}

// Open chat
function openChat(userId) {
  window.location.href = `/chat?user=${userId}`;
}

// View booking
function viewBooking(bookingId) {
  window.location.href = `/bookings/${bookingId}`;
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  // Add toast styles if not already present
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .toast {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 10000;
        animation: slideInUp 0.3s ease;
        font-weight: 600;
      }
      
      @keyframes slideInUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      .toast-success { border-left: 4px solid #10b981; color: #059669; }
      .toast-error { border-left: 4px solid #ef4444; color: #dc2626; }
      .toast-info { border-left: 4px solid #3b82f6; color: #2563eb; }
      
      .toast i {
        font-size: 1.25rem;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInUp 0.3s ease reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Real-time updates via Socket.IO
if (typeof io !== 'undefined') {
  const userData = document.getElementById('userData');
  if (userData) {
    const userId = userData.dataset.userId;
    const socket = io();
    
    socket.on('connect', () => {
      socket.emit('user_connected', userId);
    });
    
    // Listen for new bookings
    socket.on('new_booking', (data) => {
      showToast('New booking received!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    });
    
    // Listen for booking updates
    socket.on('booking_updated', (data) => {
      showToast('Booking status updated', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    });
  }
}
