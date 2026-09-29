// AI Chatbot Widget
class ChatbotWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    this.createWidget();
    this.setupEventListeners();
  }

  createWidget() {
    const widget = document.createElement('div');
    widget.id = 'chatbot-widget';
    widget.className = 'chatbot-widget';
    widget.innerHTML = `
      <div class="chatbot-button" id="chatbotButton">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <span class="chatbot-badge" id="chatbotBadge" style="display: none;">1</span>
      </div>
      
      <div class="chatbot-window" id="chatbotWindow" style="display: none;">
        <div class="chatbot-header">
          <div class="chatbot-header-content">
            <div class="chatbot-avatar">🤖</div>
            <div>
              <div class="chatbot-title">Skill Serve Assistant</div>
              <div class="chatbot-status">Online</div>
            </div>
          </div>
          <button class="chatbot-close" id="chatbotClose">×</button>
        </div>
        
        <div class="chatbot-messages" id="chatbotMessages">
          <div class="chatbot-message bot">
            <div class="message-avatar">🤖</div>
            <div class="message-bubble">
              <p>Hi! I'm your Skill Serve assistant. How can I help you today?</p>
            </div>
          </div>
        </div>
        
        <div class="chatbot-quick-replies" id="chatbotQuickReplies"></div>
        
        <div class="chatbot-input-area">
          <input 
            type="text" 
            id="chatbotInput" 
            placeholder="Type your message..." 
            autocomplete="off"
          />
          <button id="chatbotSend">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }

  setupEventListeners() {
    const button = document.getElementById('chatbotButton');
    const closeBtn = document.getElementById('chatbotClose');
    const sendBtn = document.getElementById('chatbotSend');
    const input = document.getElementById('chatbotInput');

    button.addEventListener('click', () => this.toggleWidget());
    closeBtn.addEventListener('click', () => this.closeWidget());
    sendBtn.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  toggleWidget() {
    this.isOpen = !this.isOpen;
    const window = document.getElementById('chatbotWindow');
    const button = document.getElementById('chatbotButton');
    
    if (this.isOpen) {
      window.style.display = 'flex';
      button.style.display = 'none';
      document.getElementById('chatbotInput').focus();
      this.hideBadge();
    } else {
      window.style.display = 'none';
      button.style.display = 'flex';
    }
  }

  closeWidget() {
    this.isOpen = false;
    document.getElementById('chatbotWindow').style.display = 'none';
    document.getElementById('chatbotButton').style.display = 'flex';
  }

  async sendMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();

    if (!message) return;

    // Display user message
    this.addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Send to backend
      const response = await fetch('/chatbot/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();

      // Remove typing indicator
      this.hideTypingIndicator();

      // Display bot response
      if (data.success) {
        this.addMessage(data.response, 'bot');
        if (data.quickReplies) {
          this.showQuickReplies(data.quickReplies);
        }
      } else {
        this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage('Sorry, I\'m having trouble connecting. Please try again later.', 'bot');
      console.error('Chatbot error:', error);
    }
  }

  addMessage(text, sender) {
    const messagesContainer = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}`;

    if (sender === 'bot') {
      messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-bubble">
          <p>${this.formatMessage(text)}</p>
        </div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="message-bubble">
          <p>${this.escapeHtml(text)}</p>
        </div>
      `;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    this.messages.push({ text, sender, timestamp: new Date() });
  }

  formatMessage(text) {
    // Convert line breaks to <br>
    text = this.escapeHtml(text);
    text = text.replace(/\n/g, '<br>');
    
    // Make URLs clickable
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    
    return text;
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbotMessages');
    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'chatbot-message bot';
    indicator.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-bubble typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  showQuickReplies(replies) {
    const container = document.getElementById('chatbotQuickReplies');
    container.innerHTML = '';

    replies.forEach(reply => {
      const button = document.createElement('button');
      button.className = 'quick-reply-btn';
      button.textContent = reply;
      button.addEventListener('click', () => {
        document.getElementById('chatbotInput').value = reply;
        this.sendMessage();
        container.innerHTML = '';
      });
      container.appendChild(button);
    });
  }

  showBadge(count = 1) {
    const badge = document.getElementById('chatbotBadge');
    badge.textContent = count;
    badge.style.display = 'block';
  }

  hideBadge() {
    const badge = document.getElementById('chatbotBadge');
    badge.style.display = 'none';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize chatbot widget when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Small delay to ensure page is fully loaded
  setTimeout(() => {
    window.chatbot = new ChatbotWidget();
  }, 1000);
});
