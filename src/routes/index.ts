import { Router } from 'express';
import gameRoutes from './gameRoutes';
import playlistRoutes from './playlistRoutes';

const router = Router();

router.use('/games', gameRoutes);
router.use('/playlists', playlistRoutes);


export default router;
