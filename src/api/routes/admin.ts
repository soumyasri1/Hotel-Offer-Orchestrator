import { Router, type Request, type Response } from 'express';
import { logger } from '../../logger';
import { listHotels, resetCatalogues } from '../../suppliers/catalogue';
import { resetOutages } from '../../suppliers/outage';
import { bearerToken, isAdmin, login, logout, requireAdmin } from '../auth';

/** Admin session endpoints used by the landing page. */
export function adminRoutes(): Router {
  const router = Router();

  router.post('/admin/login', (req: Request, res: Response) => {
    const password = (req.body ?? {}).password;
    if (typeof password !== 'string' || password === '') {
      res.status(400).json({ error: 'BadRequest', message: 'password is required' });
      return;
    }

    const session = login(password);
    if (!session) {
      logger.warn({ ip: req.ip }, 'failed admin login');
      res.status(401).json({ error: 'Unauthorized', message: 'Wrong password' });
      return;
    }

    logger.info({ ip: req.ip }, 'admin logged in');
    res.json({ token: session.token, expiresAt: new Date(session.expiresAt).toISOString() });
  });

  router.post('/admin/logout', (req: Request, res: Response) => {
    logout(bearerToken(req));
    res.status(204).end();
  });

  // Restores the demo: seed catalogues and both suppliers back online.
  router.post('/admin/reset', requireAdmin, (_req: Request, res: Response) => {
    resetCatalogues();
    const outages = resetOutages();
    res.json({ catalogue: { A: listHotels('A').length, B: listHotels('B').length }, outages });
  });

  // Lets the page check whether a stored token is still valid after a reload.
  router.get('/admin/session', (req: Request, res: Response) => {
    res.json({ admin: isAdmin(req) });
  });

  return router;
}
