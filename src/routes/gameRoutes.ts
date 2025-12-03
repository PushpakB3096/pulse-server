import { Router } from 'express';
import {
  createGame,
  listGames,
  syncGames
} from '../controllers/gameController';

const router = Router();

// GET /api/games
router.get('/', listGames);

// POST /api/games
router.post('/', createGame);

// POST /api/games/sync
router.post('/sync', syncGames);

export default router;
