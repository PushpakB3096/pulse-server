import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Dummy test endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    message: 'Backend is up and running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
