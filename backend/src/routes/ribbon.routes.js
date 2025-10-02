import { Router } from 'express';
import { listPublicRibbon } from '../controllers/ribbon.controller.js';

const r = Router();

// Public: GET /api/ribbon
r.get('/', listPublicRibbon);

export default r;
