import { Router } from 'express';
import { credentials } from '../schemas.js';

export function createAuthRoutes({ authService, cookies, credentialsLimiter, logger }) {
  const router = Router();

  router.post('/signup', credentialsLimiter, async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const session = await authService.signUp(email, password);

    if (session) cookies.write(res, session);
    res.status(201).json({ confirmationRequired: session === null });
  });

  router.post('/signin', credentialsLimiter, async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    cookies.write(res, await authService.signIn(email, password));
    res.status(204).end();
  });

  router.post('/signout', async (req, res) => {
    const { refreshToken } = cookies.read(req);
    if (refreshToken) {
      try {
        await authService.signOut(refreshToken);
      } catch (error) {
        logger.warn({ err: error }, 'could not revoke session on sign out');
      }
    }
    cookies.clear(res);
    res.status(204).end();
  });

  return router;
}
