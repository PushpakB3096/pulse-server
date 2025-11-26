import { Router } from 'express';
import { createGame, listGames } from '../controllers/gameController';

const router = Router();

// POST /api/games
router.post('/', createGame);

// GET /api/games
router.get('/', listGames);

export default router;
