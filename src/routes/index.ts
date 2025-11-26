import { Router } from 'express';
import gameRoutes from './gameRoutes';

const router = Router();

router.use('/games', gameRoutes);

export default router;
