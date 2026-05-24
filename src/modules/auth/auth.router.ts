import { Router } from 'express';
import { register, login, googleUpsert } from './auth.controller';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/google-upsert', googleUpsert);

export default authRouter;
