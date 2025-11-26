import { Request, Response, NextFunction } from 'express';
import { Game } from '../models/Game';

const HARD_CODED_USER_ID = 'pushpak'; // for now

export async function createGame(req: Request, res: Response, next: NextFunction) {
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

    const game = await Game.findOneAndUpdate(
      {
        userId: HARD_CODED_USER_ID,
        playniteId
      },
      {
        userId: HARD_CODED_USER_ID,
        playniteId,
        name,
        coverImageUrl,
        genres,
        tags,
        platform,
        source,
        // if provided, override defaults
        ...(typeof totalPlaytimeMinutes === 'number' && { totalPlaytimeMinutes }),
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

export async function listGames(_req: Request, res: Response, next: NextFunction) {
  try {
    const games = await Game.find({ userId: HARD_CODED_USER_ID })
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
