import { Router } from 'express';
import {
  createGame,
  getGameDetails,
  listGames,
  syncGames,
  updateGameStatus
} from '../controllers/gameController';

const router = Router();

// GET /api/games
router.get('/', listGames);

// GET /api/games/:id
router.get('/:id', getGameDetails);

// POST /api/games
router.post('/', createGame);

// POST /api/games/sync
router.post('/sync', syncGames);

// PATCH /api/games/:id/status
router.patch('/games/:id/status', updateGameStatus);

export default router;
