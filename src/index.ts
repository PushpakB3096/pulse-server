import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { connectToDatabase } from './db';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

app.get('/api/health', (_: Request, res: Response) => {
  res.json({
    ok: true,
    message: `Backend is up and running on port ${PORT}`,
    timestamp: new Date().toDateString()
  });
});

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
