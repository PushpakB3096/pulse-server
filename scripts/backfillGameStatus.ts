import 'dotenv/config';
import { Game } from '../src/models/Game';
import { connectToDatabase } from '../src/db';

async function main() {
  await connectToDatabase();

  const res = await Game.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'NOT_STARTED' } }
  );

  console.log('Updated docs:', res.modifiedCount);
  process.exit(0);
}

main();
