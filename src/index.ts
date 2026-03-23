import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { connectToDatabase } from './db';
import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const PORT = 3000;

app.get('/api/health', (_: Request, res: Response) => {
  res.json({
    ok: true,
    message: `Backend is up and running on port ${PORT}`,
    timestamp: new Date().toDateString()
  });
});

// all API routes
app.use('/api', routes);

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid id'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
);

async function start() {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
