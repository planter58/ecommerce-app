import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();
r.post('/register', ctrl.register);
r.post('/login', ctrl.login);
r.get('/me', authRequired, ctrl.me);
export default r;
