// Notification Manager
class NotificationManager {
  constructor(userId) {
    this.userId = userId;
    this.socket = io();
    this.unreadCount = 0;
    this.init();
  }

  init() {
    this.socket.emit('user-connected', this.userId);
    this.socket.emit('join-user', this.userId);
    this.setupSocketListeners();
    this.loadUnreadCount();
  }

  setupSocketListeners() {
    this.socket.on('notification', (data) => {
      this.showNotification(data);
      this.incrementUnreadCount();
    });

    this.socket.on('new-notification', (notification) => {
      this.addNotificationToList(notification);
      this.incrementUnreadCount();
    });
  }

  async loadUnreadCount() {
    try {
      const response = await fetch('/notifications/unread/count');
      const data = await response.json();
      this.updateUnreadBadge(data.count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }

  showNotification(data) {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(data.type || 'Skill Serve', {
        body: data.message,
        icon: '/images/logo.png',
        badge: '/images/badge.png',
        tag: data.type
      });

      notification.onclick = () => {
        if (data.bookingId) {
          window.location.href = `/bookings/${data.bookingId}`;
        } else if (data.chatId) {
          window.location.href = `/chat/${data.chatId}`;
        }
      };
    }

    // In-app notification toast
    this.showToast(data.message, data.type);

    // Play sound
    this.playNotificationSound();
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${this.getIconForType(type)}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  getIconForType(type) {
    const icons = {
      'booking': '📅',
      'payment': '💳',
      'chat': '💬',
      'review': '⭐',
      'promotional': '🎁',
      'system': 'ℹ️',
      'info': 'ℹ️',
      'success': '✓',
      'warning': '⚠️',
      'error': '✗'
    };
    return icons[type] || 'ℹ️';
  }

  incrementUnreadCount() {
    this.unreadCount++;
    this.updateUnreadBadge(this.unreadCount);
  }

  updateUnreadBadge(count) {
    this.unreadCount = count;
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  async markAsRead(notificationId) {
    try {
      await fetch(`/notifications/${notificationId}/read`, {
        method: 'POST'
      });
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.updateUnreadBadge(this.unreadCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      await fetch('/notifications/read-all', {
        method: 'POST'
      });
      this.updateUnreadBadge(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  addNotificationToList(notification) {
    const list = document.getElementById('notificationList');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'notification-item unread';
    item.dataset.id = notification._id;
    item.innerHTML = `
      <div class="notification-icon">${this.getIconForType(notification.type)}</div>
      <div class="notification-content">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">${this.formatTime(notification.createdAt)}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      this.markAsRead(notification._id);
      if (notification.data && notification.data.link) {
        window.location.href = notification.data.link;
      }
    });

    list.insertBefore(item, list.firstChild);
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Audio play failed:', e));
  }
}

// Initialize notification manager
document.addEventListener('DOMContentLoaded', function() {
  const userId = document.getElementById('currentUserId')?.value;
  if (userId) {
    window.notificationManager = new NotificationManager(userId);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
});
