import { Request, Response, NextFunction } from 'express';
import { Game } from '../models/Game';
import { getOrCreateDefaultUser } from '../services/userService';
import { upsertGameForUser } from '../services/gameService';

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

    // TODO: remove the logic of default user
    const userId = await getOrCreateDefaultUser();

    const game = await upsertGameForUser(userId, {
      playniteId,
      name,
      coverImageUrl,
      genres,
      tags,
      platform,
      source,
      totalPlaytimeMinutes,
      lastPlayedAt
    });

    return res.status(201).json({
      success: true,
      data: game
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
  try {
    const { games } = req.body;

    if (!Array.isArray(games) || games.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'games must be a non-empty array'
      });
    }

    const userId = await getOrCreateDefaultUser(); // later this comes from auth

    const results = await Promise.all(
      games.map(g =>
        upsertGameForUser(userId, {
          playniteId: g.playniteId,
          name: g.name,
          coverImageUrl: g.coverImageUrl,
          genres: g.genres,
          tags: g.tags,
          platform: g.platform,
          source: g.source,
          totalPlaytimeMinutes: g.totalPlaytimeMinutes,
          lastPlayedAt: g.lastPlayedAt
        })
      )
    );

    return res.status(200).json({
      success: true,
      count: results.length
    });
  } catch (err) {
    next(err);
  }
}
