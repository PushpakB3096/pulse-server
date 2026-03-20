import { Router } from 'express';
import {
  createGame,
  getEnrichmentStatusHandler,
  getGameDetails,
  listGames,
  postEnrichGames,
  syncGames,
  updateGameStatus
} from '../controllers/gameController';

const router = Router();

// GET /api/games
router.get('/', listGames);

// Must be registered before GET /:id
router.get('/enrich/status', getEnrichmentStatusHandler);
router.post('/enrich', postEnrichGames);

// POST /api/games/sync
router.post('/sync', syncGames);

// GET /api/games/:id
router.get('/:id', getGameDetails);

// POST /api/games
router.post('/', createGame);

// PATCH /api/games/:id/status
router.patch('/:id/status', updateGameStatus);

export default router;
