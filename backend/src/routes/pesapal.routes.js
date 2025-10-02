import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import * as ctrl from '../controllers/pesapal.controller.js';

const r = Router();

// User-initiated checkout: requires auth and order ownership
r.post('/initiate', authRequired, ctrl.initiate);

// IPN endpoint from Pesapal (no auth)
r.post('/ipn', ctrl.ipn);

// Optional: status polling
r.get('/status', authRequired, ctrl.status);

export default r;
