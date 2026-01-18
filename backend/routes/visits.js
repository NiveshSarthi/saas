
import express from 'express';
import * as visitController from '../controllers/visitController.js';

const router = express.Router();

router.post('/start', visitController.startVisit);
router.post('/:id/end', visitController.endVisit);
router.get('/active', visitController.getActiveVisit);
router.put('/:id/status', visitController.updateVisitStatus);
router.get('/', visitController.getVisits);

export default router;
