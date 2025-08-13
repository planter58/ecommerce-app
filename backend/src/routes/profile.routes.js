import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getProfile, updateProfile, changePassword } from '../controllers/profile.controller.js';

const r = Router();
r.get('/', authRequired, getProfile);
r.put('/', authRequired, updateProfile);
r.post('/change-password', authRequired, changePassword);
export default r;
