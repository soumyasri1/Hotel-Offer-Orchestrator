import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../logger';
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
