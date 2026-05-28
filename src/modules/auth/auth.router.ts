import { Router } from 'express';
import { register, login, googleUpsert, logout } from './auth.controller';
import { authMiddleware } from '../../shared/middleware/auth.middleware';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/google-upsert', googleUpsert);
authRouter.post('/logout', authMiddleware, logout);

export default authRouter;
