import { Router } from 'express';
import * as ctrl from '../controllers/payments.controller.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();
r.post('/create-payment-intent', authRequired, ctrl.createPaymentIntent);
r.post('/webhook', ctrl.webhook);
r.post('/mpesa/stk', authRequired, ctrl.initiateMpesaStk);
r.post('/mpesa/callback', ctrl.mpesaCallback);
export default r;
