import { Router } from 'express';
import { getPlaylists } from '../controllers/playlistController';

const router = Router();

router.get('/', getPlaylists);

export default router;
