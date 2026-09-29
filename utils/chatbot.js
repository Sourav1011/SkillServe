const Service = require('../models/Service');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;

// Intelligent real-time chatbot with database integration
class ChatBot {
  constructor() {
    this.intentPatterns = {
      // Service queries
      serviceList: /(?:what|show|list|available|all).{0,20}(?:service|services)/i,
      servicePrice: /(?:price|cost|charge|fee|how much).{0,30}(?:service|cleaning|salon|plumbing|electrical|painting|repair)/i,
      specificService: /(?:what|tell|about|info|information|detail).{0,30}(home cleaning|salon|plumbing|electrical|painting|pest control|ac repair|carpentry|appliance repair)/i,
      
      // Booking queries
      myBookings: /(?:my|view|show|check).{0,20}(?:booking|bookings|appointment)/i,
      bookService: /(?:book|schedule|make|create).{0,20}(?:service|appointment|booking)/i,
      cancelBooking: /(?:cancel|delete|remove).{0,20}(?:booking|appointment)/i,
      bookingStatus: /(?:status|where|track).{0,20}(?:booking|professional|worker)/i,
      
      // Payment & Wallet
      walletBalance: /(?:wallet|balance|money|funds|account)/i,
      paymentMethods: /(?:payment|pay|how to pay|payment method)/i,
      addMoney: /(?:add|deposit|recharge|top up).{0,20}(?:money|wallet|balance)/i,
      
      // Professional queries
      findProfessional: /(?:find|get|available|show).{0,20}(?:professional|worker|expert)/i,
      professionalForService: /(?:professional|worker|expert|technician).{0,30}(?:for|available for|in).{0,30}(home cleaning|salon|plumbing|electrical|painting|pest control|ac repair|carpentry|appliance repair)/i,
      professionalByName: /(?:slot|available|availability|schedule|timing|book|contact|about|details?|info|of|for)?.*?\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/i,
      availableSlots: /(?:available|free|open).{0,20}(?:slot|time|schedule|timing|appointment)/i,
      professionalRating: /(?:rating|review|feedback).{0,20}(?:professional|worker)/i,
      
      // General
      greetings: /^(?:hi|hello|hey|good morning|good evening|good afternoon)$/i,
      help: /(?:help|assist|support)/i,
      hours: /(?:timing|hours|schedule|when|open)/i,
      contact: /(?:contact|call|phone|email|support)/i
    };
  }

  async getResponse(message, context = {}) {
    try {
      const { userId, userName, userRole } = context;
      
      // Detect intent
      const intent = this.detectIntent(message);
      
      // Handle based on intent with real data
      switch (intent) {
        case 'greetings':
          return this.getGreeting(userName, userRole);
        
        case 'serviceList':
          return await this.getServiceList();
        
        case 'servicePrice':
          return await this.getServicePricing(message);
        
        case 'specificService':
          return await this.getSpecificServiceInfo(message);
        
        case 'myBookings':
          return await this.getUserBookings(userId);
        
        case 'bookService':
          return this.getBookingInstructions();
        
        case 'bookingStatus':
          return await this.getLatestBookingStatus(userId);
        
        case 'walletBalance':
          return await this.getWalletInfo(userId);
        
        case 'paymentMethods':
          return this.getPaymentInfo();
        
        case 'addMoney':
          return this.getAddMoneyInstructions();
        
        case 'findProfessional':
          return await this.findAvailableProfessionals(message);
        
        case 'professionalForService':
          return await this.findProfessionalsForService(message);
        
        case 'professionalByName':
          return await this.getProfessionalByName(message);
        
        case 'availableSlots':
          return await this.getAvailableTimeSlots(message, userId);
        
        case 'professionalRating':
          return await this.getProfessionalRatings(message);
        
        case 'cancelBooking':
          return this.getCancellationInfo(userId);
        
        case 'help':
          return this.getHelpMenu(userRole);
        
        case 'hours':
          return this.getBusinessHours();
        
        case 'contact':
          return this.getContactInfo();
        
        default:
          return await this.getGeminiResponse(message, context);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      return 'I apologize, I encountered an error. Please try again or contact our support team.';
    }
  }
  
  detectIntent(message) {
    // Priority order: Check more specific patterns first
    const priorityOrder = [
      // Professional queries (high priority)
      'professionalByName',
      'professionalForService',
      'availableSlots',
      'findProfessional',
      'professionalRating',
      
      // Booking queries
      'myBookings',
      'bookingStatus',
      'cancelBooking',
      'bookService',
      
      // Wallet/Payment
      'walletBalance',
      'addMoney',
      'paymentMethods',
      
      // Service queries (lower priority)
      'serviceList',
      'servicePrice',
      'specificService',
      
      // General
      'greetings',
      'help',
      'hours',
      'contact'
    ];
    
    // Check patterns in priority order
    for (const intent of priorityOrder) {
      if (this.intentPatterns[intent] && this.intentPatterns[intent].test(message)) {
        return intent;
      }
    }
    
    return 'default';
  }
  
  getGreeting(userName, userRole) {
    const time = new Date().getHours();
    let greeting = time < 12 ? 'Good morning' : time < 17 ? 'Good afternoon' : 'Good evening';
    
    if (userRole === 'professional') {
      return `${greeting}, ${userName}! 👋\n\nHow can I assist you today with your professional dashboard?`;
    }
    return `${greeting}, ${userName}! 👋\n\nI'm your SkillServe assistant. I can help you with:\n• Booking services\n• Checking your bookings\n• Finding professionals\n• Wallet & payments\n• Service information\n\nWhat would you like to know?`;
  }
  
  async getServiceList() {
    try {
      const services = await Service.find({ active: true }).select('name category price').limit(20);
      
      if (services.length === 0) {
        return 'We currently have no active services. Please check back later!';
      }
      
      // Group by category
      const grouped = {};
      services.forEach(service => {
        if (!grouped[service.category]) {
          grouped[service.category] = [];
        }
        grouped[service.category].push(service);
      });
      
      let response = '🔧 **Available Services:**\n\n';
      for (const [category, items] of Object.entries(grouped)) {
        response += `**${category}**\n`;
        items.forEach(item => {
          response += `• ${item.name} - ₹${item.price}\n`;
        });
        response += '\n';
      }
      response += 'Would you like to book any of these services?';
      
      return response;
    } catch (error) {
      return 'I can help you explore our services! Visit our Services page to see all available options.';
    }
  }
  
  async getServicePricing(message) {
    try {
      const serviceMatch = message.match(this.intentPatterns.specificService);
      if (serviceMatch) {
        const category = serviceMatch[1];
        const services = await Service.find({ 
          category: new RegExp(category, 'i'),
          active: true 
        }).select('name price duration');
        
        if (services.length > 0) {
          let response = `💰 **${services[0].category} Pricing:**\n\n`;
          services.forEach(service => {
            response += `• ${service.name}\n  Price: ₹${service.price}\n  Duration: ${service.duration} mins\n\n`;
          });
          response += 'Ready to book? Just let me know!';
          return response;
        }
      }
      
      return 'Our services are competitively priced with transparent rates. Please specify which service you\'re interested in, and I\'ll provide detailed pricing!';
    } catch (error) {
      return 'I can help you with pricing information. Which service are you interested in?';
    }
  }
  
  async getSpecificServiceInfo(message) {
    try {
      const serviceMatch = message.match(this.intentPatterns.specificService);
      if (serviceMatch) {
        const category = serviceMatch[1];
        const services = await Service.find({ 
          category: new RegExp(category, 'i'),
          active: true 
        }).limit(5);
        
        if (services.length > 0) {
          const service = services[0];
          let response = `✨ **${service.category}**\n\n`;
          services.forEach(s => {
            response += `📌 ${s.name}\n`;
            response += `💰 Price: ₹${s.price}\n`;
            response += `⏱️ Duration: ${s.duration} minutes\n`;
            response += `📝 ${s.description}\n\n`;
          });
          response += `Want to book ${service.category}? Click here: /services`;
          return response;
        }
      }
      return 'I can provide detailed information about any service. Which one interests you?';
    } catch (error) {
      return 'Let me help you find the perfect service! What are you looking for?';
    }
  }
  
  async getUserBookings(userId) {
    try {
      const bookings = await Booking.find({ customer: userId })
        .populate('service', 'name')
        .populate('professional', 'name')
        .sort({ createdAt: -1 })
        .limit(5);
      
      if (bookings.length === 0) {
        return '📅 You don\'t have any bookings yet.\n\nReady to book your first service? I can help you with that!';
      }
      
      let response = '📋 **Your Recent Bookings:**\n\n';
      bookings.forEach((booking, index) => {
        const date = new Date(booking.scheduledDate).toLocaleDateString();
        response += `${index + 1}. ${booking.service.name}\n`;
        response += `   📅 ${date} at ${booking.scheduledTime}\n`;
        response += `   Status: ${booking.status.toUpperCase()}\n`;
        if (booking.professional) {
          response += `   👤 Professional: ${booking.professional.name}\n`;
        }
        response += `   💰 ₹${booking.totalAmount}\n\n`;
      });
      
      response += 'Need to check a specific booking? Ask me!';
      return response;
    } catch (error) {
      return 'I can help you view your bookings. Visit your dashboard to see all details.';
    }
  }
  
  getBookingInstructions() {
    return `📝 **How to Book a Service:**\n\n` +
      `1️⃣ Browse available services\n` +
      `2️⃣ Select your preferred service\n` +
      `3️⃣ Choose date and time\n` +
      `4️⃣ Select or add your address\n` +
      `5️⃣ Choose a professional\n` +
      `6️⃣ Confirm and complete payment\n\n` +
      `Ready to book? Visit: /services\n\n` +
      `Need help choosing a service? Just ask!`;
  }
  
  async getLatestBookingStatus(userId) {
    try {
      const booking = await Booking.findOne({ customer: userId })
        .populate('service', 'name')
        .populate('professional', 'name phone')
        .sort({ createdAt: -1 });
      
      if (!booking) {
        return 'You don\'t have any bookings to track yet. Ready to book a service?';
      }
      
      const date = new Date(booking.scheduledDate).toLocaleDateString();
      let response = `📍 **Latest Booking Status:**\n\n`;
      response += `Service: ${booking.service.name}\n`;
      response += `Date: ${date} at ${booking.scheduledTime}\n`;
      response += `Status: **${booking.status.toUpperCase()}**\n`;
      response += `Amount: ₹${booking.totalAmount}\n`;
      
      if (booking.professional) {
        response += `\n👤 **Professional:**\n`;
        response += `Name: ${booking.professional.name}\n`;
        if (booking.professional.phone) {
          response += `Contact: ${booking.professional.phone}\n`;
        }
      }
      
      if (booking.status === 'confirmed' || booking.status === 'in-progress') {
        response += `\n🔴 Track live: /tracking/${booking._id}`;
      }
      
      return response;
    } catch (error) {
      return 'I can help you track your bookings. Visit your bookings page for real-time updates!';
    }
  }
  
  async getWalletInfo(userId) {
    try {
      const wallet = await Wallet.findOne({ user: userId });
      
      if (!wallet) {
        return `💳 **Wallet Information:**\n\nBalance: ₹0.00\n\nYour wallet is empty. Would you like to add money?`;
      }
      
      let response = `💳 **Your Wallet:**\n\n`;
      response += `💰 Balance: ₹${wallet.balance.toFixed(2)}\n`;
      response += `📊 Total Earned: ₹${wallet.totalEarnings.toFixed(2)}\n`;
      response += `📉 Total Spent: ₹${wallet.totalSpent.toFixed(2)}\n\n`;
      
      if (wallet.transactions && wallet.transactions.length > 0) {
        response += `Recent Transaction: ${wallet.transactions[wallet.transactions.length - 1].description}\n\n`;
      }
      
      response += `Manage wallet: /wallet`;
      return response;
    } catch (error) {
      return 'I can help you with wallet information. Visit /wallet to see your balance and transactions.';
    }
  }
  
  getPaymentInfo() {
    return `💳 **Payment Methods:**\n\n` +
      `We accept:\n` +
      `✅ Wallet (Instant & Secure)\n` +
      `✅ Credit/Debit Cards\n` +
      `✅ UPI\n` +
      `✅ Cash on Delivery\n\n` +
      `💡 **Benefits of Wallet:**\n` +
      `• Instant payment\n` +
      `• Cashback offers\n` +
      `• Quick refunds\n` +
      `• Exclusive discounts\n\n` +
      `All payments are 100% secure! 🔒`;
  }
  
  getAddMoneyInstructions() {
    return `💰 **Add Money to Wallet:**\n\n` +
      `1. Go to Wallet section: /wallet\n` +
      `2. Click "Add Money"\n` +
      `3. Enter amount\n` +
      `4. Choose payment method\n` +
      `5. Complete payment\n\n` +
      `✨ Get instant cashback on wallet top-ups!`;
  }
  
  async findAvailableProfessionals(message) {
    try {
      const professionals = await User.find({ 
        role: 'professional',
        isOnline: true 
      })
      .select('name profession rating totalReviews serviceCategories')
      .limit(5);
      
      if (professionals.length === 0) {
        return 'Currently, all our professionals are busy. But don\'t worry! Book a service and we\'ll assign the best professional for you.';
      }
      
      let response = `👥 **Available Professionals:**\n\n`;
      professionals.forEach((prof, index) => {
        response += `${index + 1}. ${prof.name}\n`;
        response += `   Expertise: ${prof.profession || prof.serviceCategories.join(', ') || 'Multiple Services'}\n`;
        response += `   ⭐ Rating: ${prof.rating ? prof.rating.toFixed(1) : 'New'}/5`;
        if (prof.totalReviews > 0) {
          response += ` (${prof.totalReviews} reviews)`;
        }
        response += `\n\n`;
      });
      
      response += `All our professionals are verified and background-checked! 🛡️`;
      return response;
    } catch (error) {
      return 'All our professionals are verified, trained, and rated by customers. When you book, we match you with the best professional for your needs!';
    }
  }
  
  async findProfessionalsForService(message) {
    try {
      const serviceMatch = message.match(this.intentPatterns.professionalForService);
      if (!serviceMatch || !serviceMatch[1]) {
        return 'Please specify which service you need. For example: "professionals for home cleaning" or "electricians available"';
      }
      
      const serviceCategory = serviceMatch[1];
      const categoryFormatted = serviceCategory
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Find professionals with this service category
      const professionals = await User.find({ 
        role: 'professional',
        serviceCategories: categoryFormatted,
        'availability.isAvailable': true
      })
      .select('name profession rating totalReviews serviceCategories experience phone isOnline')
      .sort({ rating: -1, totalReviews: -1 })
      .limit(10);
      
      if (professionals.length === 0) {
        return `Currently, no professionals are available for ${categoryFormatted}. However, you can book the service and we'll assign the best available professional to you! 📅`;
      }
      
      let response = `🔧 **${categoryFormatted} Professionals Available:**\n\n`;
      response += `Found ${professionals.length} professional${professionals.length > 1 ? 's' : ''}!\n\n`;
      
      professionals.forEach((prof, index) => {
        response += `${index + 1}. **${prof.name}**\n`;
        response += `   📋 Services: ${prof.serviceCategories.join(', ')}\n`;
        
        if (prof.experience) {
          response += `   💼 Experience: ${prof.experience} years\n`;
        }
        
        response += `   ⭐ Rating: ${prof.rating ? prof.rating.toFixed(1) : 'New'}/5`;
        if (prof.totalReviews > 0) {
          response += ` (${prof.totalReviews} reviews)`;
        }
        response += `\n`;
        
        response += `   🟢 Status: ${prof.isOnline ? 'Online Now' : 'Available'}\n`;
        response += `\n`;
      });
      
      response += `\n💡 Ready to book ${categoryFormatted}? Visit /services to get started!\n\n`;
      response += `Need to check available time slots? Just ask!`;
      
      return response;
    } catch (error) {
      console.error('Error finding professionals for service:', error);
      return 'I can help you find professionals for any service. Please specify the service type (e.g., home cleaning, plumbing, electrical).';
    }
  }
  
  async getProfessionalByName(message) {
    try {
      // Extract name from message (look for capitalized words)
      const nameMatch = message.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
      
      if (!nameMatch) {
        return `I'd be happy to help you find a professional! Could you please provide the professional's full name? For example: "Rajesh Kumar" or "Priya Sharma"`;
      }
      
      const searchName = nameMatch[1];
      
      // Search for professional by name (case-insensitive)
      const professional = await User.findOne({ 
        name: new RegExp(searchName, 'i'),
        role: 'professional'
      })
      .select('name profession serviceCategories rating totalReviews experience phone isOnline availability');
      
      if (!professional) {
        // Use Gemini AI to provide intelligent response with suggestions
        console.log('👤 Professional not found, using Gemini for smart suggestions');
        
        // Get similar professionals to suggest
        const allProfessionals = await User.find({ 
          role: 'professional',
          'availability.isAvailable': true
        })
        .select('name serviceCategories rating totalReviews experience')
        .sort({ rating: -1 })
        .limit(5);
        
        if (genAI && allProfessionals.length > 0) {
          try {
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            
            let profList = allProfessionals.map(p => 
              `${p.name} - ${p.serviceCategories.join(', ')} - Rating: ${p.rating ? p.rating.toFixed(1) : 'New'}/5`
            ).join('\\n');
            
            const prompt = `User is looking for a professional named "${searchName}" but they don't exist in our system.

Available professionals in our system:
${profList}

Provide a helpful, friendly response that:
1. Politely says we couldn't find "${searchName}"
2. Suggests the most similar or relevant professionals from the list above
3. Asks if they want to see details about any of them
4. Keep it conversational and helpful

Response:`;

            const result = await model.generateContent(prompt);
            return result.response.text();
          } catch (error) {
            console.error('Gemini error in name fallback:', error);
          }
        }
        
        // Final fallback if Gemini fails
        return `I couldn't find a professional named "${searchName}" in our system. 🤔\n\n` +
          `Would you like me to:\n` +
          `• Show all available professionals\n` +
          `• Find professionals for a specific service\n` +
          `• Help you book a service\n\n` +
          `Just let me know!`;
      }
      
      // Build detailed response about this professional
      let response = `👤 **${professional.name}**\n\n`;
      
      // Services offered
      if (professional.serviceCategories && professional.serviceCategories.length > 0) {
        response += `🔧 **Services:**\n${professional.serviceCategories.map(s => `   • ${s}`).join('\n')}\n\n`;
      }
      
      // Experience
      if (professional.experience) {
        response += `💼 **Experience:** ${professional.experience} years\n`;
      }
      
      // Rating
      response += `⭐ **Rating:** ${professional.rating ? professional.rating.toFixed(1) : 'New'}/5`;
      if (professional.totalReviews > 0) {
        response += ` (${professional.totalReviews} reviews)`;
      }
      response += `\n\n`;
      
      // Online status
      response += `🟢 **Status:** ${professional.isOnline ? 'Online Now' : 'Available'}\n\n`;
      
      // Availability details
      if (professional.availability) {
        response += `📅 **Availability:**\n\n`;
        
        if (professional.availability.isAvailable) {
          // Working days
          if (professional.availability.workingDays && professional.availability.workingDays.length > 0) {
            response += `**Working Days:**\n${professional.availability.workingDays.join(', ')}\n\n`;
          }
          
          // Time slots
          if (professional.availability.timeSlots && professional.availability.timeSlots.length > 0) {
            response += `**Working Hours:**\n`;
            professional.availability.timeSlots.forEach(slot => {
              response += `   ${slot.start} - ${slot.end}\n`;
            });
            response += `\n`;
          } else {
            response += `**Working Hours:** 9:00 AM - 9:00 PM\n\n`;
          }
          
          // Generate available slots for next 3 days
          const today = new Date();
          response += `**Next Available Slots:**\n\n`;
          
          for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Check if this day is in working days
            if (!professional.availability.workingDays || 
                professional.availability.workingDays.length === 0 || 
                professional.availability.workingDays.includes(dayName)) {
              response += `📌 **${dayName}, ${dateStr}**\n`;
              response += `   • 9:00 AM - 12:00 PM\n`;
              response += `   • 2:00 PM - 5:00 PM\n`;
              response += `   • 6:00 PM - 9:00 PM\n\n`;
            }
          }
        } else {
          response += `Currently not available. Please check back later or choose another professional.\n\n`;
        }
      } else {
        response += `📅 **Available:** Monday - Saturday, 9:00 AM - 9:00 PM\n\n`;
      }
      
      // Contact info
      if (professional.phone) {
        response += `📱 **Contact:** ${professional.phone}\n\n`;
      }
      
      response += `💡 Ready to book ${professional.name}? Visit /services to schedule an appointment!`;
      
      return response;
      
    } catch (error) {
      console.error('Error getting professional by name:', error);
      return 'I can help you find information about our professionals! Please provide the professional\'s name, and I\'ll show you their availability and details.';
    }
  }
  
  async getAvailableTimeSlots(message, userId) {
    try {
      // FIRST: Check if asking about a specific professional by name
      const nameMatch = message.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
      if (nameMatch) {
        // Redirect to getProfessionalByName if a name is found
        console.log('\uD83D\uDC64 Detected professional name in availability query:', nameMatch[1]);
        return await this.getProfessionalByName(message);
      }
      
      // SECOND: Check if asking about a specific service
      const serviceMatch = message.match(/(home cleaning|salon|plumbing|electrical|painting|pest control|ac repair|carpentry|appliance repair)/i);
      
      if (serviceMatch) {
        const serviceCategory = serviceMatch[1];
        const categoryFormatted = serviceCategory
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Find professionals for this service
        const professionals = await User.find({ 
          role: 'professional',
          serviceCategories: categoryFormatted,
          'availability.isAvailable': true
        })
        .select('name availability')
        .limit(3);
        
        if (professionals.length === 0) {
          return `No professionals currently available for ${categoryFormatted}. Please try booking and we'll find someone for you!`;
        }
        
        // Get today and next 3 days
        const today = new Date();
        const availableDates = [];
        
        for (let i = 0; i < 4; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          availableDates.push({ dayName, dateStr, date });
        }
        
        let response = `📅 **Available Slots for ${categoryFormatted}:**\n\n`;
        
        // Show general availability for next few days
        response += `**Next 4 Days:**\n\n`;
        availableDates.forEach(({ dayName, dateStr }) => {
          response += `📌 **${dayName}, ${dateStr}**\n`;
          response += `   • Morning: 9:00 AM - 12:00 PM\n`;
          response += `   • Afternoon: 2:00 PM - 5:00 PM\n`;
          response += `   • Evening: 6:00 PM - 9:00 PM\n\n`;
        });
        
        // Show professionals and their working hours
        response += `**Available Professionals:**\n\n`;
        professionals.forEach((prof, index) => {
          response += `${index + 1}. ${prof.name}\n`;
          if (prof.availability && prof.availability.workingDays) {
            response += `   Working Days: ${prof.availability.workingDays.join(', ')}\n`;
          }
          if (prof.availability && prof.availability.timeSlots && prof.availability.timeSlots.length > 0) {
            const slot = prof.availability.timeSlots[0];
            response += `   Hours: ${slot.start} - ${slot.end}\n`;
          } else {
            response += `   Hours: 9:00 AM - 9:00 PM\n`;
          }
          response += `\n`;
        });
        
        response += `\n💡 **Tip:** Book at least 2 hours in advance for confirmed slots!\n`;
        response += `\nReady to book? Visit: /services`;
        
        return response;
      } else {
        // General availability query
        return `📅 **General Availability:**\n\n` +
          `Our services are available:\n` +
          `🕐 **Timing:** 7:00 AM - 10:00 PM (All days)\n\n` +
          `**Popular Slots:**\n` +
          `• Morning: 9:00 AM - 12:00 PM\n` +
          `• Afternoon: 2:00 PM - 5:00 PM\n` +
          `• Evening: 6:00 PM - 9:00 PM\n\n` +
          `💡 **Tips:**\n` +
          `• Weekday mornings have best availability\n` +
          `• Weekend slots fill up fast - book early!\n` +
          `• Emergency services available with extra charges\n\n` +
          `Which service are you interested in? I can show you specific professional availability!`;
      }
    } catch (error) {
      console.error('Error getting available slots:', error);
      return 'I can help you find available time slots! Please specify the service you need, and I\'ll show you when our professionals are available.';
    }
  }
  
  async getProfessionalRatings(message) {
    try {
      const topProfessionals = await User.find({ 
        role: 'professional',
        rating: { $gt: 4 }
      })
      .select('name profession rating totalReviews')
      .sort({ rating: -1, totalReviews: -1 })
      .limit(5);
      
      if (topProfessionals.length === 0) {
        return 'All our professionals maintain high quality standards. Book any service with confidence!';
      }
      
      let response = `⭐ **Top Rated Professionals:**\n\n`;
      topProfessionals.forEach((prof, index) => {
        response += `${index + 1}. ${prof.name}\n`;
        response += `   ${prof.profession || 'Multi-service'}\n`;
        response += `   ⭐ ${prof.rating.toFixed(1)}/5 (${prof.totalReviews} reviews)\n\n`;
      });
      
      response += `Book now to work with the best! 🌟`;
      return response;
    } catch (error) {
      return 'Our professionals are highly rated by customers. You can see ratings when booking any service!';
    }
  }
  
  getCancellationInfo(userId) {
    return `❌ **Cancellation Policy:**\n\n` +
      `✅ **Free Cancellation:**\n` +
      `Cancel up to 2 hours before scheduled time\n\n` +
      `💰 **Refund Process:**\n` +
      `• Instant refund to wallet\n` +
      `• 3-5 days for card payments\n\n` +
      `📋 **How to Cancel:**\n` +
      `1. Go to My Bookings\n` +
      `2. Select the booking\n` +
      `3. Click "Cancel Booking"\n` +
      `4. Confirm cancellation\n\n` +
      `Need to cancel a booking? Visit: /bookings/my-bookings`;
  }
  
  getHelpMenu(userRole) {
    if (userRole === 'professional') {
      return `🆘 **Professional Help Menu:**\n\n` +
        `I can help you with:\n` +
        `• Viewing your bookings\n` +
        `• Checking your earnings\n` +
        `• Wallet & payouts\n` +
        `• Customer reviews\n` +
        `• Profile settings\n\n` +
        `What would you like to know?`;
    }
    
    return `🆘 **Help Menu:**\n\n` +
      `I can assist you with:\n\n` +
      `📋 **Services & Booking:**\n` +
      `• View all services\n` +
      `• Get pricing info\n` +
      `• Book a service\n` +
      `• Track bookings\n\n` +
      `💳 **Payments:**\n` +
      `• Wallet balance\n` +
      `• Add money\n` +
      `• Payment methods\n\n` +
      `👥 **Professionals:**\n` +
      `• Find professionals\n` +
      `• View ratings\n\n` +
      `❓ Just ask me anything!`;
  }
  
  getBusinessHours() {
    return `🕐 **Service Hours:**\n\n` +
      `Monday - Sunday: 7:00 AM - 10:00 PM\n\n` +
      `📞 **Customer Support:**\n` +
      `24/7 Available\n\n` +
      `💡 **Tips:**\n` +
      `• Book 24 hours in advance for best availability\n` +
      `• Emergency services available with extra charges\n` +
      `• Weekend slots fill up fast - book early!`;
  }
  
  getContactInfo() {
    return `📞 **Contact Us:**\n\n` +
      `📧 Email: support@skillserve.com\n` +
      `📱 Phone: +91-XXXXXXXXXX\n` +
      `💬 Chat: Available 24/7 (here!)\n\n` +
      `🏢 **Office:**\n` +
      `SkillServe Technologies\n` +
      `[Your Address]\n\n` +
      `We typically respond within:\n` +
      `• Chat: Instant\n` +
      `• Email: 24 hours\n` +
      `• Phone: During business hours`;
  }
  
  async getGeminiResponse(message, context) {
    try {
      // If Gemini is not configured, fallback to smart response
      if (!genAI) {
        console.log('⚠️ Gemini AI not configured, using smart response');
        return this.getSmartResponse(message, context);
      }
      
      console.log('🤖 Using Gemini AI for query:', message);

      const { userId, userName, userRole } = context;
      
      // Gather platform data context
      const platformContext = await this.gatherPlatformContext(userId, message);
      
      // Create the model
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Build context-aware prompt
      const prompt = `You are a helpful customer service assistant for SkillServe, a home services booking platform. 

User Information:
- Name: ${userName || 'Guest'}
- Role: ${userRole || 'customer'}
${userId ? `- User ID: ${userId}` : ''}

Platform Context:
${platformContext}

User's Question: "${message}"

Important Guidelines:
1. Use the platform context data to give SPECIFIC, ACCURATE answers with real numbers
2. If asking about professionals, services, bookings, or wallet - use the provided data
3. Be friendly, helpful, and conversational
4. Keep responses concise but informative
5. If the data shows specific information, share it directly
6. Use emojis sparingly for a professional yet friendly tone
7. Always provide actionable next steps or relevant links
8. Format responses clearly with line breaks for readability

Provide a helpful, accurate response based on the platform data:`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return text || this.getSmartResponse(message, context);
      
    } catch (error) {
      console.error('❌ Gemini AI error:', error.message || error);
      console.log('⚠️ Falling back to smart response');
      // Fallback to smart response if Gemini fails
      return this.getSmartResponse(message, context);
    }
  }
  
  async gatherPlatformContext(userId, message) {
    let context = '';
    
    try {
      // Get service-related data
      const services = await Service.find({ active: true }).select('name category price').limit(10);
      if (services.length > 0) {
        context += `\nAvailable Services (${services.length} total):\n`;
        services.forEach(s => {
          context += `- ${s.name} (${s.category}) - ₹${s.price}\n`;
        });
      }
      
      // Get professional data if message mentions finding professionals
      if (/professional|worker|expert|available/i.test(message)) {
        const professionals = await User.find({ 
          role: 'professional',
          'availability.isAvailable': true 
        })
        .select('name serviceCategories rating totalReviews experience isOnline')
        .limit(5);
        
        if (professionals.length > 0) {
          context += `\nAvailable Professionals (${professionals.length}):\n`;
          professionals.forEach(p => {
            context += `- ${p.name} | Services: ${p.serviceCategories.join(', ')} | Rating: ${p.rating ? p.rating.toFixed(1) : 'New'}/5`;
            if (p.experience) context += ` | Experience: ${p.experience} years`;
            context += ` | Status: ${p.isOnline ? 'Online' : 'Available'}\n`;
          });
        }
      }
      
      // Get user's booking data if they have userId
      if (userId) {
        const bookings = await Booking.find({ customer: userId })
          .populate('service', 'name')
          .sort({ createdAt: -1 })
          .limit(3);
        
        if (bookings.length > 0) {
          context += `\nUser's Recent Bookings (${bookings.length}):\n`;
          bookings.forEach(b => {
            const date = new Date(b.scheduledDate).toLocaleDateString();
            context += `- ${b.service.name} on ${date} at ${b.scheduledTime} - Status: ${b.status.toUpperCase()} - ₹${b.totalAmount}\n`;
          });
        }
        
        // Get wallet info if asking about payment/wallet
        if (/wallet|balance|payment|money/i.test(message)) {
          const wallet = await Wallet.findOne({ user: userId });
          if (wallet) {
            context += `\nUser's Wallet:\n`;
            context += `- Balance: ₹${wallet.balance.toFixed(2)}\n`;
            context += `- Total Earned: ₹${wallet.totalEarnings.toFixed(2)}\n`;
            context += `- Total Spent: ₹${wallet.totalSpent.toFixed(2)}\n`;
          }
        }
      }
      
      // Platform information
      context += `\nPlatform Information:\n`;
      context += `- Service Hours: 7:00 AM - 10:00 PM (Daily)\n`;
      context += `- Payment Methods: Wallet, Credit/Debit Cards, UPI, Cash on Delivery\n`;
      context += `- Cancellation: Free up to 2 hours before scheduled time\n`;
      context += `- Service Categories: Home Cleaning, Salon, Plumbing, Electrical, Painting, Pest Control, AC Repair, Carpentry, Appliance Repair\n`;
      
      return context || 'No specific platform data available for this query.';
      
    } catch (error) {
      console.error('Error gathering platform context:', error);
      return 'Platform data temporarily unavailable.';
    }
  }
  
  getSmartResponse(message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Check for common questions
    if (lowerMessage.includes('thank')) {
      return `You're welcome! 😊 Is there anything else I can help you with?`;
    }
    
    if (lowerMessage.includes('yes') || lowerMessage.includes('sure')) {
      return `Great! What would you like to do?\n\n` +
        `• View services\n` +
        `• Check bookings\n` +
        `• Wallet info\n` +
        `• Find professionals\n\n` +
        `Just let me know!`;
    }
    
    if (lowerMessage.includes('no')) {
      return `No problem! Feel free to ask if you need anything else. I'm here to help! 😊`;
    }
    
    // Try to extract useful context from the message
    const hasServiceName = /(home cleaning|salon|plumbing|electrical|painting|pest control|ac repair|carpentry|appliance repair)/i.test(message);
    const hasName = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(message);
    const hasBooking = /(book|appointment|schedule)/i.test(lowerMessage);
    const hasPrice = /(price|cost|charge|fee)/i.test(lowerMessage);
    const hasSlot = /(slot|time|timing|schedule|available|when)/i.test(lowerMessage);
    
    // Intelligent contextual response
    if (hasName && hasSlot) {
      return `I'd love to help you check availability! Could you please rephrase like:\n\n` +
        `"Show me available slots for [Professional Name]"\n` +
        `or\n` +
        `"What is [Professional Name]'s schedule?"\n\n` +
        `I'll show you their complete availability! 📅`;
    }
    
    if (hasServiceName && hasSlot) {
      return `I can help you find available time slots! Try asking:\n\n` +
        `"Available slots for [service name]"\n` +
        `or\n` +
        `"When can I book [service name]?"\n\n` +
        `I'll show you all available times! ⏰`;
    }
    
    if (hasServiceName && hasPrice) {
      return `I can show you pricing! Try:\n\n` +
        `"What's the price for [service name]?"\n` +
        `or\n` +
        `"How much does [service name] cost?"\n\n` +
        `I'll give you exact pricing! 💰`;
    }
    
    if (hasServiceName) {
      return `I see you're asking about a service! I can help with:\n\n` +
        `• "Professionals for [service name]" - Find experts\n` +
        `• "Price of [service name]" - Get pricing\n` +
        `• "Available slots for [service name]" - Check timing\n\n` +
        `What would you like to know? 🤔`;
    }
    
    if (hasBooking) {
      return `I can help you book a service! 📅\n\n` +
        `You can:\n` +
        `• "Show me all services" - Browse services\n` +
        `• "Book [service name]" - Book directly\n` +
        `• "My bookings" - Check existing bookings\n\n` +
        `What would you like to do?`;
    }
    
    // Default response with suggestions
    return `I'm here to help! 😊 You can ask me:\n\n` +
      `💬 **Natural questions like:**\n` +
      `• "Which professionals are available for home cleaning?"\n` +
      `• "Show me Rajesh Kumar's available slots"\n` +
      `• "What's my wallet balance?"\n` +
      `• "How much does plumbing cost?"\n\n` +
      `📋 **Quick actions:**\n` +
      `• "My bookings"\n` +
      `• "Available services"\n` +
      `• "Find professionals"\n\n` +
      `Try asking in your own words - I'll understand! 🎯`;
  }

  isComplexQuery(message) {
    // Determine if query needs AI processing
    const complexIndicators = [
      'why', 'how does', 'explain', 'difference between',
      'compare', 'recommend', 'suggest', 'best'
    ];
    return complexIndicators.some(indicator => 
      message.toLowerCase().includes(indicator)
    );
  }

  async getAIResponse(message, context = {}) {
    // OpenAI integration (optional - requires API key)
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a helpful customer service assistant for Skill Serve, 
                       a home services platform. Help users with booking services, 
                       pricing information, tracking professionals, and general queries.
                       Keep responses concise and helpful.`
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      throw error;
    }
  }

  // Get suggested quick replies
  getQuickReplies(lastCategory) {
    const quickReplies = {
      greetings: ['Book a service', 'View services', 'Pricing info'],
      bookingHelp: ['Show services', 'Track booking', 'Payment methods'],
      services: ['Home Cleaning', 'Salon', 'Plumbing', 'Electrical'],
      pricing: ['Book now', 'View all services', 'Payment options'],
      payment: ['Book a service', 'Wallet balance', 'Add money'],
      cancellation: ['Cancel booking', 'View policy', 'Contact support'],
      professional: ['Book service', 'View ratings', 'Safety measures'],
      tracking: ['Track now', 'Contact professional', 'Booking status'],
      default: ['Available services', 'How to book', 'Pricing', 'Contact support']
    };

    return quickReplies[lastCategory] || quickReplies.default;
  }
}

module.exports = new ChatBot();
