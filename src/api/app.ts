import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../logger';
import { LANDING_PAGE_HTML } from './landingPage';
import { adminRoutes } from './routes/admin';
import { healthRoutes } from './routes/health';
import { hotelRoutes } from './routes/hotels';
import { supplierRoutes } from './routes/suppliers';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      // Health polling is noisy; keep it at debug.
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        if (req.url?.startsWith('/health')) return 'debug';
        return 'info';
      },
    }),
  );

  // Browsers get the interactive landing page; API clients (curl, Postman send
  // */*) get the JSON index, because res.format picks the first listed type.
  app.get('/', (_req: Request, res: Response) => {
    res.format({
      'application/json': () => {
        res.json({
          service: 'hotel-offer-orchestrator',
          endpoints: {
            'GET /api/hotels?city=delhi&minPrice=&maxPrice=': 'Deduplicated best offer per hotel, filtered by price in Redis',
            'GET /health': 'Per-dependency health, including both suppliers',
            'GET /supplierA/hotels?city=delhi': 'Mock Supplier A catalogue',
            'GET /supplierB/hotels?city=delhi': 'Mock Supplier B catalogue',
            'GET /suppliers/control': 'Simulated outage state',
            'POST /admin/login': 'Exchange the admin password for a bearer token, body {"password":"..."}',
            'POST /suppliers/{A|B}/hotels': 'Admin: add a hotel, body {"name","city","price","commissionPct"}',
            'DELETE /suppliers/{A|B}/hotels/{hotelId}': 'Admin: remove a hotel',
            'POST /suppliers/{A|B}/control': 'Admin: toggle a supplier outage, body {"down":true} or {"delayMs":8000}',
          },
        });
      },
      'text/html': () => {
        res.type('html').send(LANDING_PAGE_HTML);
      },
    });
  });

  app.use(adminRoutes());
  app.use(healthRoutes());
  app.use(hotelRoutes());
  app.use(supplierRoutes());

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'NotFound', message: `No route for ${req.method} ${req.path}` });
  });

  // Express 4 identifies the error handler by its four-parameter signature.
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, path: req.path }, 'unhandled error in request pipeline');
    if (res.headersSent) return;
    res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
  });

  return app;
}
