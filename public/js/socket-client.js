// Socket.IO Client for Real-time Updates

// Initialize Socket.IO connection
const socket = io();

// Connection status
let isConnected = false;

socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
  isConnected = true;
  updateConnectionStatus(true);
  
  // Join user room if user is logged in
  const userId = getUserId();
  if (userId && userId.trim() !== '' && userId !== 'null' && userId !== 'undefined') {
    socket.emit('user-connected', userId);
    socket.emit('join-user', userId);
  }
  
  // Join booking rooms if on booking pages
  joinBookingRooms();
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  isConnected = false;
  updateConnectionStatus(false);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  isConnected = false;
  updateConnectionStatus(false);
});

// Listen for notifications
socket.on('notification', (data) => {
  console.log('Notification received:', data);
  showNotification(data);
});

// Listen for booking updates
socket.on('status-update', (data) => {
  console.log('Booking status update:', data);
  updateBookingStatus(data);
});

// Listen for new bookings (for professionals)
socket.on('new-booking-notification', (data) => {
  console.log('New booking available:', data);
  showNewBookingAlert(data);
});

// Update connection status indicator
function updateConnectionStatus(connected) {
  const statusIndicator = document.getElementById('connectionStatus');
  if (statusIndicator) {
    if (connected) {
      statusIndicator.className = 'connection-status connected';
      statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Connected';
    } else {
      statusIndicator.className = 'connection-status disconnected';
      statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
    }
  }
}

// Get user ID from page data
function getUserId() {
  const userDataEl = document.getElementById('userData');
  if (userDataEl && userDataEl.dataset.userId) {
    const userId = userDataEl.dataset.userId.trim();
    if (userId && userId !== 'null' && userId !== 'undefined') {
      return userId;
    }
  }
  return null;
}

// Join booking rooms for current page
function joinBookingRooms() {
  const bookingElements = document.querySelectorAll('[data-booking-id]');
  bookingElements.forEach(el => {
    const bookingId = el.dataset.bookingId;
    if (bookingId) {
      socket.emit('join-booking', bookingId);
    }
  });
}

// Listen for booking status updates
socket.on('status-update', (data) => {
  console.log('Booking status update:', data);
  
  // Update booking card status
  const bookingCard = document.getElementById(`booking-${data.bookingId}`);
  if (bookingCard) {
    const statusBadge = bookingCard.querySelector('.booking-status, .status-badge');
    if (statusBadge) {
      statusBadge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
      statusBadge.className = `status-badge status-${data.status}`;
    }
    
    // Show notification
    showNotification(`Booking status updated to ${data.status}`, 'success');
    
    // Refresh if needed
    if (data.reload) {
      setTimeout(() => location.reload(), 2000);
    }
  }
});

// Listen for notifications
socket.on('notification', (data) => {
  console.log('Notification received:', data);
  showNotification(data.message, data.type || 'info');
  
  // Play notification sound
  playNotificationSound();
  
  // Update notification badge if exists
  updateNotificationBadge();
});

// Listen for new booking notifications (for providers)
socket.on('new-booking-notification', (data) => {
  console.log('New booking notification:', data);
  
  // Check if user is a provider
  const userRole = document.querySelector('[data-user-role]')?.dataset.userRole;
  if (userRole === 'professional') {
    showNotification(`New booking request for ${data.serviceName}!`, 'success');
    playNotificationSound();
    
    // Update bookings list if on dashboard - ADD NEW BOOKING TO LIST
    if (window.location.pathname.includes('/profile/professional')) {
      setTimeout(() => location.reload(), 2000);
    }
  }
});

// Listen for booking accepted event (for customers)
socket.on('booking-accepted', (data) => {
  console.log('Booking accepted:', data);
  
  // Update booking card status
  const bookingCard = document.getElementById(`booking-${data.bookingId}`);
  if (bookingCard) {
    const statusBadge = bookingCard.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'awaiting-payment';
      statusBadge.className = 'status-badge status-awaiting-payment';
    }
    
    // Add payment button to booking actions
    const actions = bookingCard.querySelector('.booking-actions');
    if (actions) {
      const payBtn = document.createElement('a');
      payBtn.href = data.paymentUrl;
      payBtn.className = 'btn btn-small';
      payBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      payBtn.style.color = 'white';
      payBtn.innerHTML = '<i class="fas fa-credit-card"></i> Pay Now';
      actions.insertBefore(payBtn, actions.firstChild);
    }
  }
  
  // Show notification with payment action
  showNotification(`${data.professionalName} accepted your booking! Click to pay.`, 'success');
  playNotificationSound();
  
  // If on booking detail page, show payment alert
  if (window.location.pathname.includes(`/bookings/${data.bookingId}`)) {
    setTimeout(() => location.reload(), 1000);
  }
});

// Listen for booking declined event (for customers)
socket.on('booking-declined', (data) => {
  console.log('Booking declined:', data);
  
  const bookingCard = document.getElementById(`booking-${data.bookingId}`);
  if (bookingCard) {
    const statusBadge = bookingCard.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'cancelled';
      statusBadge.className = 'status-badge status-cancelled';
    }
  }
  
  showNotification(`${data.professionalName} declined your booking.`, 'error');
  playNotificationSound();
});

// Listen for booking accepted event (for customers) - UPDATED WITH PAYMENT ALERTS
socket.on('booking-accepted', (data) => {
  console.log('Booking accepted:', data);
  
  // Update booking card status
  const bookingCard = document.getElementById(`booking-${data.bookingId}`);
  if (bookingCard) {
    const statusBadge = bookingCard.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'awaiting-payment';
      statusBadge.className = 'status-badge status-awaiting-payment';
    }
    
    // Add payment alert banner at top of card
    const existingAlert = bookingCard.querySelector('.payment-alert-banner');
    if (!existingAlert) {
      const alertBanner = document.createElement('div');
      alertBanner.className = 'payment-alert-banner';
      alertBanner.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; margin: -16px -16px 15px -16px; text-align: center; font-weight: 600;';
      alertBanner.innerHTML = '<i class="fas fa-exclamation-circle"></i> Payment Required - Professional Accepted Your Booking!';
      bookingCard.insertBefore(alertBanner, bookingCard.firstChild);
    }
    
    // Add payment button to booking actions
    const actions = bookingCard.querySelector('.booking-actions');
    if (actions) {
      const existingPayBtn = actions.querySelector('.pay-now-btn');
      if (!existingPayBtn) {
        const payBtn = document.createElement('a');
        payBtn.href = data.paymentUrl;
        payBtn.className = 'btn btn-small pay-now-btn';
        payBtn.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: 600; margin-left: 0.5rem;';
        payBtn.innerHTML = '<i class="fas fa-credit-card"></i> Pay Now';
        
        // Insert after "View Details" button
        const viewDetailsBtn = actions.querySelector('a[href*="/bookings/"]');
        if (viewDetailsBtn) {
          viewDetailsBtn.insertAdjacentElement('afterend', payBtn);
        } else {
          actions.appendChild(payBtn);
        }
      }
    }
    
    // Highlight the card with animation
    bookingCard.style.animation = 'pulse 1s ease-in-out 3';
    setTimeout(() => {
      bookingCard.style.animation = '';
    }, 3000);
  }
  
  // Show prominent notification
  showNotification(`🎉 ${data.professionalName} accepted your booking! Please complete payment to confirm.`, 'success');
  playNotificationSound();
  
  // If on booking detail page, reload to show payment banner
  if (window.location.pathname.includes(`/bookings/${data.bookingId}`)) {
    setTimeout(() => location.reload(), 1000);
  }
});

// Listen for booking declined event (for customers)
socket.on('booking-declined', (data) => {
  console.log('Booking declined:', data);
  
  const bookingCard = document.getElementById(`booking-${data.bookingId}`);
  if (bookingCard) {
    const statusBadge = bookingCard.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'cancelled';
      statusBadge.className = 'status-badge status-cancelled';
    }
  }
  
  showNotification(`${data.professionalName} declined your booking.`, 'error');
  playNotificationSound();
});

// Listen for typing indicator (for future chat feature)
socket.on('user-typing', (data) => {
  console.log(`${data.userName} is typing...`);
  showTypingIndicator(data.userName);
});

// Show notification toast
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existing = document.querySelector('.socket-notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `socket-notification ${type}`;
  
  const iconMap = {
    success: 'check-circle',
    error: 'exclamation-circle',
    info: 'info-circle',
    warning: 'exclamation-triangle'
  };
  
  notification.innerHTML = `
    <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="close-notification">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Play notification sound
function playNotificationSound() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.3;
    audio.play().catch(err => console.log('Audio play failed:', err));
  } catch (err) {
    console.log('Audio not available');
  }
}

// Update notification badge count
function updateNotificationBadge() {
  const badge = document.querySelector('#notificationBadge');
  if (badge) {
    const currentCount = parseInt(badge.textContent) || 0;
    badge.textContent = currentCount + 1;
    badge.style.display = 'flex';
  }
}

// Fetch and update initial badge counts
async function fetchInitialBadgeCounts() {
  try {
    // Fetch unread notifications count
    const notifResponse = await fetch('/notifications/unread/count');
    if (notifResponse.ok) {
      const { count } = await notifResponse.json();
      const notifBadge = document.querySelector('#notificationBadge');
      if (notifBadge && count > 0) {
        notifBadge.textContent = count;
        notifBadge.style.display = 'flex';
      }
    }
    
    // Fetch unread chats count
    const chatResponse = await fetch('/chat/unread-count');
    if (chatResponse.ok) {
      const { unreadCount } = await chatResponse.json();
      const chatBadge = document.querySelector('#chatBadge');
      if (chatBadge && unreadCount > 0) {
        chatBadge.textContent = unreadCount;
        chatBadge.style.display = 'flex';
      }
    }
  } catch (error) {
    console.error('Error fetching badge counts:', error);
  }
}

// Call on page load if user is logged in
if (getUserId()) {
  fetchInitialBadgeCounts();
}

// Show typing indicator
function showTypingIndicator(userName) {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.textContent = `${userName} is typing...`;
    indicator.style.display = 'block';
    
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
  }
}

// Emit booking update
function emitBookingUpdate(bookingId, status, customerId, providerId) {
  if (isConnected) {
    socket.emit('booking-update', {
      bookingId,
      status,
      customerId,
      providerId,
      timestamp: new Date().toISOString()
    });
  }
}

// Emit new booking
function emitNewBooking(bookingData) {
  if (isConnected) {
    socket.emit('new-booking', bookingData);
  }
}

// Export functions for use in other scripts
window.socketIO = {
  socket,
  isConnected: () => isConnected,
  emitBookingUpdate,
  emitNewBooking,
  showNotification
};

// CSS Styles for notifications
const style = document.createElement('style');
style.textContent = `
  .connection-status {
    position: fixed;
    bottom: 20px;
    left: 20px;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 9998;
    transition: all 0.3s ease;
  }
  
  .connection-status.connected {
    background: #d4edda;
    color: #155724;
  }
  
  .connection-status.disconnected {
    background: #f8d7da;
    color: #721c24;
  }
  
  .connection-status i {
    font-size: 0.5rem;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .socket-notification {
    position: fixed;
    top: 100px;
    right: 20px;
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 1rem;
    z-index: 9999;
    animation: slideInRight 0.3s ease;
    max-width: 400px;
    min-width: 300px;
  }
  
  .socket-notification.success {
    border-left: 4px solid #28a745;
  }
  
  .socket-notification.error {
    border-left: 4px solid #dc3545;
  }
  
  .socket-notification.info {
    border-left: 4px solid #17a2b8;
  }
  
  .socket-notification.warning {
    border-left: 4px solid #ffc107;
  }
  
  .socket-notification i:first-child {
    font-size: 1.5rem;
  }
  
  .socket-notification.success i:first-child {
    color: #28a745;
  }
  
  .socket-notification.error i:first-child {
    color: #dc3545;
  }
  
  .socket-notification.info i:first-child {
    color: #17a2b8;
  }
  
  .socket-notification.warning i:first-child {
    color: #ffc107;
  }
  
  .close-notification {
    background: none;
    border: none;
    cursor: pointer;
    color: #6c757d;
    margin-left: auto;
    padding: 0.25rem;
  }
  
  .close-notification:hover {
    color: #000;
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  @media (max-width: 768px) {
    .socket-notification {
      right: 10px;
      left: 10px;
      max-width: none;
      min-width: 0;
    }
    
    .connection-status {
      bottom: 10px;
      left: 10px;
    }
  }
`;
document.head.appendChild(style);

// Toast notification function
window.showToast = function(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// Add connection status indicator to page
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('connectionStatus')) {
    const statusEl = document.createElement('div');
    statusEl.id = 'connectionStatus';
    statusEl.className = 'connection-status';
    document.body.appendChild(statusEl);
    updateConnectionStatus(isConnected);
  }
});
