const express = require('express');
const queueController = require('../controllers/queueController');
const authenticate = require('../middlewares/auth');
const { mongoIdValidator } = require('../validators/common');
const validate = require('../middlewares/validate');

const router = express.Router();

router.get('/', authenticate, queueController.list);
router.get('/analytics', authenticate, queueController.analytics);
router.get('/tokens/:tokenId', authenticate, mongoIdValidator('tokenId'), validate, queueController.getById);
router.post('/join', authenticate, queueController.join);
router.post('/cancel/:doctorId', authenticate, mongoIdValidator('doctorId'), validate, queueController.cancel);
router.post('/next/:doctorId', authenticate, mongoIdValidator('doctorId'), validate, queueController.next);
router.post('/next-patient/:doctorId', authenticate, mongoIdValidator('doctorId'), validate, queueController.next);
router.post('/reorder/:doctorId', authenticate, mongoIdValidator('doctorId'), validate, queueController.reorder);
router.get('/eta/:doctorId', authenticate, mongoIdValidator('doctorId'), validate, queueController.updateETA);
router.post('/eta/:doctorId', authenticate, mongoIdValidator('doctorId'), validate, queueController.updateETA);
router.post('/status/:entryId', authenticate, mongoIdValidator('entryId'), validate, queueController.updateStatus);
router.post('/skip/:entryId', authenticate, mongoIdValidator('entryId'), validate, queueController.skip);

// Patch endpoints for token lifecycle
router.patch('/tokens/:tokenId/start-journey', authenticate, mongoIdValidator('tokenId'), validate, queueController.startJourney);
router.patch('/tokens/:tokenId/arrive', authenticate, mongoIdValidator('tokenId'), validate, queueController.arrive);
router.patch('/tokens/:tokenId/start-service', authenticate, mongoIdValidator('tokenId'), validate, queueController.startService);
router.patch('/tokens/:tokenId/complete', authenticate, mongoIdValidator('tokenId'), validate, queueController.complete);
router.patch('/tokens/:tokenId/smart-hold', authenticate, mongoIdValidator('tokenId'), validate, queueController.smartHold);

// Session controls
router.patch('/sessions/:sessionId/pause', authenticate, mongoIdValidator('sessionId'), validate, queueController.pauseSession);
router.patch('/sessions/:sessionId/resume', authenticate, mongoIdValidator('sessionId'), validate, queueController.resumeSession);
router.patch('/sessions/:sessionId/end', authenticate, mongoIdValidator('sessionId'), validate, queueController.endSession);

module.exports = router;
