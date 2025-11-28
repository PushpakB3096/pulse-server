import { Request, Response, NextFunction } from 'express';
import { Game } from '../models/Game';
import { getOrCreateDefaultUser } from '../services/userService';

export async function createGame(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
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
    } = req.body;

    if (!playniteId || !name || !platform || !source) {
      return res.status(400).json({
        success: false,
        message: 'playniteId, name, platform, and source are required'
      });
    }

    // TODO: remove the logic of default user
    const userId = await getOrCreateDefaultUser();

    const game = await Game.findOneAndUpdate(
      {
        userId,
        playniteId
      },
      {
        userId,
        playniteId,
        name,
        coverImageUrl,
        genres,
        tags,
        platform,
        source,
        // if provided, override defaults
        ...(typeof totalPlaytimeMinutes === 'number' && {
          totalPlaytimeMinutes
        }),
        ...(lastPlayedAt && { lastPlayedAt })
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    return res.status(201).json({
      success: true,
      data: game
    });
  } catch (err) {
    next(err);
  }
}

export async function listGames(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = await getOrCreateDefaultUser();
    const games = await Game.find({ userId })
      .sort({ lastPlayedAt: -1, name: 1 })
      .lean();

    return res.json({
      success: true,
      data: games
    });
  } catch (err) {
    next(err);
  }
}

export async function syncGames(
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.log('Received games:', req.body);
  return res.status(200).json({ ok: true });
}
