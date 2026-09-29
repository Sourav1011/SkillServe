// Real-time chat functionality
class ChatManager {
  constructor(chatId, currentUserId) {
    this.chatId = chatId;
    this.currentUserId = currentUserId;
    this.socket = io();
    this.typingTimeout = null;
    this.init();
  }

  init() {
    // Join chat room
    this.socket.emit('join-chat', this.chatId);

    // Listen for new messages
    this.socket.on('new-message', (data) => {
      if (data.chatId === this.chatId) {
        this.displayMessage(data.message);
        this.playNotificationSound();
      }
    });

    // Listen for typing indicator
    this.socket.on('user-typing', (data) => {
      if (data.chatId === this.chatId && data.userId !== this.currentUserId) {
        this.showTypingIndicator(data.userName);
      }
    });

    this.socket.on('user-stop-typing', (data) => {
      if (data.chatId === this.chatId) {
        this.hideTypingIndicator();
      }
    });

    // Listen for messages read
    this.socket.on('messages-read', (data) => {
      if (data.chatId === this.chatId) {
        this.markMessagesAsRead();
      }
    });

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const fileInput = document.getElementById('fileInput');

    if (sendButton) {
      sendButton.addEventListener('click', () => this.sendMessage());
    }

    if (messageInput) {
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      messageInput.addEventListener('input', () => {
        this.handleTyping();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files[0]);
      });
    }
  }

  sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();

    if (!content) return;

    this.socket.emit('send-message', {
      chatId: this.chatId,
      senderId: this.currentUserId,
      content: content,
      type: 'text'
    });

    messageInput.value = '';
    this.socket.emit('stop-typing', { chatId: this.chatId, userId: this.currentUserId });
  }

  displayMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const isSent = message.sender.toString() === this.currentUserId;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    messageDiv.innerHTML = `
      <div class="message-content">
        <p>${this.escapeHtml(message.content)}</p>
        <span class="message-time">${time}</span>
        ${isSent && message.isRead ? '<span class="read-indicator">✓✓</span>' : ''}
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  handleTyping() {
    this.socket.emit('typing', {
      chatId: this.chatId,
      userId: this.currentUserId,
      userName: document.getElementById('currentUserName')?.value || 'User'
    });

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('stop-typing', {
        chatId: this.chatId,
        userId: this.currentUserId
      });
    }, 1000);
  }

  showTypingIndicator(userName) {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.textContent = `${userName} is typing...`;
      indicator.style.display = 'block';
    }
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  markMessagesAsRead() {
    const messages = document.querySelectorAll('.message.sent .read-indicator');
    messages.forEach(msg => {
      msg.textContent = '✓✓';
      msg.style.color = 'blue';
    });
  }

  playNotificationSound() {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(e => console.log('Audio play failed:', e));
  }

  handleFileUpload(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch(`/chat/${this.chatId}/upload`, {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        this.socket.emit('send-message', {
          chatId: this.chatId,
          senderId: this.currentUserId,
          content: file.name,
          type: 'file',
          fileUrl: data.fileUrl
        });
      }
    })
    .catch(err => console.error('File upload error:', err));
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', function() {
  const chatContainer = document.getElementById('chatContainer');
  if (chatContainer) {
    const chatId = chatContainer.dataset.chatId;
    const userId = chatContainer.dataset.userId;
    new ChatManager(chatId, userId);
  }
});
