require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Service = require('./models/Service');
const Booking = require('./models/Booking');

const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

async function seedDatabase() {
  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Service.deleteMany({});
    await Booking.deleteMany({});

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@skillserve.com',
      phone: '9999999999',
      password: 'admin123',
      role: 'admin',
      profileImage: 'https://ui-avatars.com/api/?name=Admin&background=2E3192&color=fff&size=200'
    });
    console.log('✓ Admin user created');

    // Create customer user
    const customer = await User.create({
      name: 'John Doe',
      email: 'customer@example.com',
      phone: '9876543210',
      password: 'customer123',
      role: 'customer',
      profileImage: 'https://ui-avatars.com/api/?name=John+Doe&background=2E3192&color=fff&size=200'
    });
    console.log('✓ Customer user created');

    // Create multiple professional users
    const professionals = await User.create([
      {
        name: 'Rajesh Kumar',
        email: 'rajesh@skillserve.com',
        phone: '9876543211',
        password: 'professional123',
        role: 'professional',
        profession: 'Home Cleaning Specialist',
        serviceCategories: ['Home Cleaning'],
        experience: 5,
        rating: 4.8,
        totalReviews: 234,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Rajesh+Kumar&background=059669&color=fff&size=200'
      },
      {
        name: 'Priya Sharma',
        email: 'priya@skillserve.com',
        phone: '9876543212',
        password: 'professional123',
        role: 'professional',
        profession: 'Salon Expert',
        serviceCategories: ['Salon'],
        experience: 7,
        rating: 4.9,
        totalReviews: 456,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=DB2777&color=fff&size=200'
      },
      {
        name: 'Amit Patel',
        email: 'amit@skillserve.com',
        phone: '9876543213',
        password: 'professional123',
        role: 'professional',
        profession: 'AC Repair Technician',
        serviceCategories: ['AC Repair', 'Appliance Repair'],
        experience: 8,
        rating: 4.7,
        totalReviews: 389,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Amit+Patel&background=2563EB&color=fff&size=200'
      },
      {
        name: 'Sneha Reddy',
        email: 'sneha@skillserve.com',
        phone: '9876543214',
        password: 'professional123',
        role: 'professional',
        profession: 'Home Cleaning Expert',
        serviceCategories: ['Home Cleaning'],
        experience: 4,
        rating: 4.6,
        totalReviews: 178,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Sneha+Reddy&background=F59E0B&color=fff&size=200'
      },
      {
        name: 'Vikram Singh',
        email: 'vikram@skillserve.com',
        phone: '9876543215',
        password: 'professional123',
        role: 'professional',
        profession: 'Electrician',
        serviceCategories: ['Electrical'],
        experience: 10,
        rating: 4.9,
        totalReviews: 567,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Vikram+Singh&background=9333EA&color=fff&size=200'
      },
      {
        name: 'Anjali Verma',
        email: 'anjali@skillserve.com',
        phone: '9876543216',
        password: 'professional123',
        role: 'professional',
        profession: 'Beautician',
        serviceCategories: ['Salon'],
        experience: 6,
        rating: 4.8,
        totalReviews: 345,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Anjali+Verma&background=EC4899&color=fff&size=200'
      },
      {
        name: 'Rahul Gupta',
        email: 'rahul@skillserve.com',
        phone: '9876543217',
        password: 'professional123',
        role: 'professional',
        profession: 'Plumber',
        serviceCategories: ['Plumbing'],
        experience: 9,
        rating: 4.7,
        totalReviews: 412,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Rahul+Gupta&background=0284C7&color=fff&size=200'
      },
      {
        name: 'Kavita Joshi',
        email: 'kavita@skillserve.com',
        phone: '9876543218',
        password: 'professional123',
        role: 'professional',
        profession: 'House Cleaning Professional',
        serviceCategories: ['Home Cleaning'],
        experience: 3,
        rating: 4.5,
        totalReviews: 145,
        isOnline: false,
        profileImage: 'https://ui-avatars.com/api/?name=Kavita+Joshi&background=10B981&color=fff&size=200'
      },
      {
        name: 'Deepak Mehta',
        email: 'deepak@skillserve.com',
        phone: '9876543219',
        password: 'professional123',
        role: 'professional',
        profession: 'Painter',
        serviceCategories: ['Painting'],
        experience: 12,
        rating: 4.9,
        totalReviews: 678,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Deepak+Mehta&background=F97316&color=fff&size=200'
      },
      {
        name: 'Meera Iyer',
        email: 'meera@skillserve.com',
        phone: '9876543220',
        password: 'professional123',
        role: 'professional',
        profession: 'Carpenter',
        serviceCategories: ['Carpentry'],
        experience: 7,
        rating: 4.6,
        totalReviews: 289,
        isOnline: true,
        profileImage: 'https://ui-avatars.com/api/?name=Meera+Iyer&background=8B5CF6&color=fff&size=200'
      }
    ]);
    console.log('✓ Professional users created');

    // Create services
    const services = [
      // Salon Services
      {
        name: 'Women\'s Haircut & Styling',
        category: 'Salon',
        description: 'Professional haircut with styling including wash, cut, and blow dry',
        price: 599,
        duration: 60,
        features: ['Consultation', 'Hair wash', 'Haircut', 'Styling', 'Free hair serum'],
        image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500',
        images: [
          'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
          'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800',
          'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800',
          'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800'
        ],
        active: true,
        rating: 4.7,
        reviewCount: 234
      },
      {
        name: 'Spa Pedicure & Manicure',
        category: 'Salon',
        description: 'Relaxing spa pedicure and manicure with nail art options',
        price: 899,
        duration: 90,
        features: ['Foot soak', 'Scrub & massage', 'Nail polish', 'Nail art', 'Moisturizing'],
        image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500',
        images: [
          'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800',
          'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800',
          'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=800',
          'https://images.unsplash.com/photo-1599948128020-9a44c7d5c412?w=800'
        ],
        active: true,
        rating: 4.8,
        reviewCount: 189
      },
      // Home Cleaning
      {
        name: 'Deep Home Cleaning',
        category: 'Home Cleaning',
        description: 'Comprehensive deep cleaning of your entire home including kitchen and bathrooms',
        price: 1499,
        duration: 240,
        features: ['All rooms', 'Kitchen deep clean', 'Bathroom sanitization', 'Dusting', 'Floor mopping'],
        image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500',
        images: [
          'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800',
          'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800',
          'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=800',
          'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800'
        ],
        active: true,
        rating: 4.9,
        reviewCount: 567
      },
      {
        name: 'Bathroom Cleaning',
        category: 'Home Cleaning',
        description: 'Professional bathroom deep cleaning and sanitization',
        price: 499,
        duration: 60,
        features: ['Toilet cleaning', 'Sink & mirror', 'Floor scrubbing', 'Anti-bacterial spray', 'Drain cleaning'],
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500',
        images: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800',
          'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800',
          'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800',
          'https://images.unsplash.com/photo-1564182379166-8fcfdda80151?w=800'
        ],
        active: true,
        rating: 4.6,
        reviewCount: 298
      },
      // AC Repair
      {
        name: 'AC Service & Repair',
        category: 'AC Repair',
        description: 'Complete AC servicing including gas refill and deep cleaning',
        price: 799,
        duration: 90,
        features: ['Gas check', 'Filter cleaning', 'Coil cleaning', 'Leak detection', '30-day warranty'],
        image: 'https://images.unsplash.com/photo-1631545835768-7ff3c92e76ba?w=500',
        images: [
          'https://images.unsplash.com/photo-1631545835768-7ff3c92e76ba?w=800',
          'https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=800',
          'https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=800',
          'https://images.unsplash.com/photo-1622973536968-3ead9e780126?w=800'
        ],
        active: true,
        rating: 4.5,
        reviewCount: 445
      },
      // Electrician
      {
        name: 'Electrical Wiring & Installation',
        category: 'Electrical',
        description: 'Professional electrical wiring, switch/socket installation and repairs',
        price: 599,
        duration: 75,
        features: ['Safety check', 'Wiring repair', 'Switch installation', 'Socket installation', 'Testing'],
        image: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=500',
        images: [
          'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800',
          'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800',
          'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800',
          'https://images.unsplash.com/photo-1590856029620-23a2bec9e1c0?w=800'
        ],
        active: true,
        rating: 4.7,
        reviewCount: 312
      },
      // Plumbing
      {
        name: 'Plumbing Repair & Installation',
        category: 'Plumbing',
        description: 'Expert plumbing services for leaks, blockages, and installations',
        price: 499,
        duration: 60,
        features: ['Leak repair', 'Tap installation', 'Drain cleaning', 'Pipe repair', 'Emergency service'],
        image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=500',
        images: [
          'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800',
          'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800',
          'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800',
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800'
        ],
        active: true,
        rating: 4.6,
        reviewCount: 278
      },
      // Painting
      {
        name: 'Interior Wall Painting',
        category: 'Painting',
        description: 'Professional interior wall painting with premium quality paints',
        price: 2999,
        duration: 1440,
        features: ['Surface preparation', 'Primer coat', '2 coats painting', 'Premium paints', 'Cleanup'],
        image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500',
        images: [
          'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800',
          'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800',
          'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800',
          'https://images.unsplash.com/photo-1605296867424-35fc25c9212a?w=800'
        ],
        active: true,
        rating: 4.8,
        reviewCount: 156
      },
      // Appliance Repair
      {
        name: 'Washing Machine Repair',
        category: 'Appliance Repair',
        description: 'Expert repair for all washing machine brands and models',
        price: 699,
        duration: 90,
        features: ['Diagnosis', 'Part replacement', 'Performance check', '30-day warranty', 'All brands'],
        image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500',
        images: [
          'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800',
          'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=800',
          'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=800',
          'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=800'
        ],
        active: true,
        rating: 4.5,
        reviewCount: 203
      }
    ];

    await Service.insertMany(services);
    console.log(`✓ ${services.length} services created`);

    // Create sample bookings
    const sampleBooking = await Booking.create({
      customer: customer._id,
      service: (await Service.findOne({ name: 'Deep Home Cleaning' }))._id,
      professional: professionals[0]._id,
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      scheduledTime: '10:00 AM',
      address: '123 Main Street, Near Central Park, Mumbai, Maharashtra - 400001',
      status: 'confirmed',
      totalAmount: 1499,
      paymentMethod: 'online',
      paymentStatus: 'completed',
      notes: 'Please bring all cleaning supplies'
    });
    console.log('✓ Sample booking created');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📝 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:');
    console.log('  Email: admin@skillserve.com');
    console.log('  Password: admin123');
    console.log('\nCustomer:');
    console.log('  Email: customer@example.com');
    console.log('  Phone: 9876543210');
    console.log('  Password: customer123');
    console.log('\nProfessionals (10 total):');
    console.log('  Email: rajesh@skillserve.com (Home Cleaning)');
    console.log('  Email: priya@skillserve.com (Salon)');
    console.log('  Email: amit@skillserve.com (AC Repair)');
    console.log('  Password: professional123 (for all)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
