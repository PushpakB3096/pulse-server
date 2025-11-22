import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('MONGO_URI is not set in environment variables');
}

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(MONGO_URI as string);
  console.log('Connected to MongoDB');
}
