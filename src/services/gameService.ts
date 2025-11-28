import { Game } from '../models/Game';
import { Types } from 'mongoose';

export interface GameUpsertInput {
  playniteId: string;
  name: string;
  coverImageUrl?: string;
  genres?: string[];
  tags?: string[];
  platform: string;
  source: string;
  totalPlaytimeMinutes?: number;
  lastPlayedAt?: Date | string | null;
}

export async function upsertGameForUser(
  userId: Types.ObjectId | string,
  payload: GameUpsertInput
) {
  const {
    playniteId,
    name,
    coverImageUrl,
    genres,
    tags,
    platform,
    source,
    totalPlaytimeMinutes,
    lastPlayedAt
  } = payload;

  console.log(1111, {payload: JSON.stringify(payload, null, 2)});

  if (!playniteId || !name || !platform || !source) {
    throw new Error('playniteId, name, platform, and source are required');
  }

  const update: any = {
    userId,
    playniteId,
    name,
    coverImageUrl,
    genres,
    tags,
    platform,
    source
  };

  if (typeof totalPlaytimeMinutes === 'number') {
    update.totalPlaytimeMinutes = totalPlaytimeMinutes;
  }

  if (lastPlayedAt) {
    update.lastPlayedAt = lastPlayedAt;
  }

  return Game.findOneAndUpdate({ userId, playniteId }, update, {
    new: true,
    upsert: true,
    runValidators: true
  });
}
