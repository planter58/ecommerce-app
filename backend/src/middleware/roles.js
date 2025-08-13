export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!(roles.includes(req.user.role) || req.user.role === 'super_admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
