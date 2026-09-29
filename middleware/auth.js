// Middleware to check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  console.log('========== AUTH CHECK ==========');
  console.log('Session ID:', req.sessionID);
  console.log('Session user:', req.session.user);
  console.log('Has user?', !!req.session.user);
  console.log('================================\n');
  
  if (req.session.user) {
    return next(); 
  }
  req.session.error = 'Please login to continue';
  res.redirect('/auth/login');
};

// Middleware to check if user is customer
exports.isCustomer = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'customer') {
    return next();
  }
  req.session.error = 'Access denied';
  res.redirect('/');
};

// Middleware to check if user is professional
exports.isProfessional = (req, res, next) => {
  console.log('========== PROFESSIONAL CHECK ==========');
  console.log('User role:', req.session.user?.role);
  console.log('Is professional?', req.session.user?.role === 'professional');
  console.log('=======================================\n');
  
  if (req.session.user && req.session.user.role === 'professional') {
    return next();
  }
  req.session.error = 'Access denied';
  res.redirect('/');
};

// Middleware to check if user is admin
exports.isAdmin = (req, res, next) => {
  console.log('========== ADMIN CHECK ==========');
  console.log('User role:', req.session.user?.role);
  console.log('Is admin?', req.session.user?.role === 'admin');
  console.log('=================================\n');
  
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.session.error = 'Access denied';
  res.redirect('/');
};

// Middleware to check if user is guest (not logged in)
exports.isGuest = (req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  res.redirect('/');
};
