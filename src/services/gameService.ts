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
    let dateValue: Date | null = null;

    if (lastPlayedAt instanceof Date) {
      dateValue = lastPlayedAt;
    } else if (typeof lastPlayedAt === 'string') {
      // Clean up date string (remove spaces around colons in time and timezone)
      // Handles cases like "2025-07-31T21: 57: 15.301+05: 30" -> "2025-07-31T21:57:15.301+05:30"
      const cleanedDateString = lastPlayedAt
        .replace(/:\s+/g, ':') // Remove spaces after colons
        .replace(/\s+:/g, ':'); // Remove spaces before colons (just in case)
      dateValue = new Date(cleanedDateString);
    }

    // Only set if date is valid
    if (dateValue && !isNaN(dateValue.getTime())) {
      update.lastPlayedAt = dateValue;
    } else if (lastPlayedAt === null) {
      // Explicitly allow null to clear the field
      update.lastPlayedAt = null;
    }
  }

  return Game.findOneAndUpdate(
    { userId, playniteId },
    {
      $set: update,
      $setOnInsert: {
        status: 'NOT_STARTED'
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );
}
