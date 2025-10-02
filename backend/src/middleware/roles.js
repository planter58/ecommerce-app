export function requireRole(...roles) {
  const normalize = (v) => {
    const cur = String(v ?? '').trim().toLowerCase();
    if (cur === 'administrator') return 'admin';
    if (cur === 'admin  ') return 'admin';
    if (cur === 'admin1') return 'admin';
    return cur;
  };
  const allowed = new Set(roles.map(r => normalize(r)));
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const current = normalize(req.user.role);
    if (!(allowed.has(current) || current === 'super_admin')) {
      if (process.env.DEBUG_AUTH === 'true') {
        return res.status(403).json({ message: 'Forbidden', role: req.user.role, normalized_role: current, requires_any_of: Array.from(allowed) });
      }
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
