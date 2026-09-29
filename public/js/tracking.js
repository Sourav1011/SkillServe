// Live tracking functionality
class TrackingManager {
  constructor(bookingId) {
    this.bookingId = bookingId;
    this.socket = io();
    this.map = null;
    this.professionalMarker = null;
    this.customerMarker = null;
    this.routeLine = null;
    this.init();
  }

  init() {
    this.initializeMap();
    this.socket.emit('join-booking', this.bookingId);
    this.setupSocketListeners();
    this.fetchCurrentLocation();
  }

  initializeMap() {
    // Get customer location from page data
    const customerLat = parseFloat(document.getElementById('customerLat')?.value || 28.6139);
    const customerLng = parseFloat(document.getElementById('customerLng')?.value || 77.2090);

    // Initialize map (using Leaflet.js)
    this.map = L.map('trackingMap').setView([customerLat, customerLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Add customer marker
    this.customerMarker = L.marker([customerLat, customerLng], {
      icon: L.divIcon({
        className: 'customer-marker',
        html: '<div class="marker-pin customer-pin">📍</div>',
        iconSize: [40, 40]
      })
    }).addTo(this.map).bindPopup('Your Location');
  }

  setupSocketListeners() {
    this.socket.on('location-update', (data) => {
      if (data.bookingId === this.bookingId) {
        this.updateProfessionalLocation(data);
      }
    });

    this.socket.on('professional-reached', (data) => {
      if (data.bookingId === this.bookingId) {
        this.showReachedNotification(data.message);
      }
    });

    this.socket.on('service-status', (data) => {
      if (data.bookingId === this.bookingId) {
        this.updateServiceStatus(data);
      }
    });
  }

  async fetchCurrentLocation() {
    try {
      const response = await fetch(`/tracking/api/${this.bookingId}/current`);
      const data = await response.json();

      if (data.found) {
        this.updateProfessionalLocation(data.location);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    }
  }

  updateProfessionalLocation(data) {
    const [lng, lat] = data.coordinates || data.location;

    // Update or create professional marker
    if (this.professionalMarker) {
      this.professionalMarker.setLatLng([lat, lng]);
    } else {
      this.professionalMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'professional-marker',
          html: '<div class="marker-pin professional-pin">🚗</div>',
          iconSize: [40, 40]
        })
      }).addTo(this.map).bindPopup('Professional');
    }

    // Update route line
    if (this.customerMarker) {
      const customerLatLng = this.customerMarker.getLatLng();
      
      if (this.routeLine) {
        this.map.removeLayer(this.routeLine);
      }

      this.routeLine = L.polyline([
        [lat, lng],
        [customerLatLng.lat, customerLatLng.lng]
      ], {
        color: '#4CAF50',
        weight: 3,
        dashArray: '10, 10'
      }).addTo(this.map);
    }

    // Fit map to show both markers
    const bounds = L.latLngBounds([
      [lat, lng],
      this.customerMarker.getLatLng()
    ]);
    this.map.fitBounds(bounds, { padding: [50, 50] });

    // Update info panel
    this.updateInfoPanel(data);
  }

  updateInfoPanel(data) {
    const statusEl = document.getElementById('trackingStatus');
    const etaEl = document.getElementById('eta');
    const distanceEl = document.getElementById('distance');

    if (statusEl) {
      const statusText = {
        'on-the-way': 'Professional is on the way',
        'reached': 'Professional has arrived',
        'working': 'Service in progress',
        'completed': 'Service completed'
      };
      statusEl.textContent = statusText[data.status] || data.status;
      statusEl.className = `status-badge ${data.status}`;
    }

    if (etaEl && data.eta) {
      const eta = new Date(data.eta);
      etaEl.textContent = `ETA: ${eta.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }

    if (distanceEl && data.distance) {
      distanceEl.textContent = `${data.distance.toFixed(1)} km away`;
    }
  }

  showReachedNotification(message) {
    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Skill Serve', {
        body: message,
        icon: '/images/logo.png'
      });
    }

    // Show in-page notification
    const notification = document.createElement('div');
    notification.className = 'alert alert-success notification-popup';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);

    // Play sound
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
  }

  updateServiceStatus(data) {
    const statusEl = document.getElementById('serviceStatus');
    if (statusEl) {
      statusEl.textContent = data.message;
      statusEl.className = `alert alert-info ${data.status}`;
    }
  }

  // Call professional
  callProfessional() {
    const phoneNumber = document.getElementById('professionalPhone')?.value;
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  }

  // Chat with professional
  openChat() {
    const chatUrl = `/chat/${document.getElementById('chatId')?.value}`;
    window.location.href = chatUrl;
  }
}

// Initialize tracking when page loads
document.addEventListener('DOMContentLoaded', function() {
  const trackingContainer = document.getElementById('trackingContainer');
  if (trackingContainer) {
    const bookingId = trackingContainer.dataset.bookingId;
    new TrackingManager(bookingId);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
});
