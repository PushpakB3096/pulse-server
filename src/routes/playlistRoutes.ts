import { Router } from 'express';
import {
  addGamesToPlaylist,
  getPlaylists,
  removeGameFromPlaylist,
  getPlaylistById
} from '../controllers/playlistController';

const router = Router();

// GET /api/playlists
router.get('/', getPlaylists);

// GET /api/playlists/:id
router.get('/:id', getPlaylistById);

// DELETE /api/playlists/:playlistId/games/:gameId — remove one game
router.delete('/:playlistId/games/:gameId', removeGameFromPlaylist);

// PATCH /api/playlists/:id — add game(s); body: { gameId?, gameIds? }
router.patch('/:id', addGamesToPlaylist);

export default router;
