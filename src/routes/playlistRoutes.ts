import { Router } from 'express';
import {
  addGamesToPlaylist,
  getPlaylists,
  removeGameFromPlaylist
} from '../controllers/playlistController';

const router = Router();

// GET /api/playlists
router.get('/', getPlaylists);

// DELETE /api/playlists/:playlistId/games/:gameId — remove one game
router.delete('/:playlistId/games/:gameId', removeGameFromPlaylist);

// PATCH /api/playlists/:id — add game(s); body: { gameId?, gameIds? }
router.patch('/:id', addGamesToPlaylist);

export default router;
