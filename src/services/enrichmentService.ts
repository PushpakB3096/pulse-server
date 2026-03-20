import PQueue from 'p-queue';
import mongoose, { Types } from 'mongoose';
import { Game } from '../models/Game';
import { postIgdb, normalizeIgdbImageUrl } from './igdbClient';

const RECENT_MAX = 20;

export type EnrichmentMatchKind =
  | 'external_games'
  | 'links'
  | 'name_search'
  | 'cached_igdb_id';

export interface EnrichmentRecentEntry {
  at: string;
  gameMongoId: string;
  gameName: string;
  status: 'completed' | 'failed' | 'skipped';
  match?: EnrichmentMatchKind;
  error?: string;
  durationMs?: number;
}

const recentEnrichmentResults: EnrichmentRecentEntry[] = [];

function pushRecent(entry: EnrichmentRecentEntry): void {
  recentEnrichmentResults.unshift(entry);
  if (recentEnrichmentResults.length > RECENT_MAX) {
    recentEnrichmentResults.length = RECENT_MAX;
  }
}

export const enrichmentQueue = new PQueue({
  concurrency: 1,
  intervalCap: 4,
  interval: 1000
});

export function getEnrichmentStatus(): {
  pending: number;
  inProgress: number;
  recent: EnrichmentRecentEntry[];
} {
  return {
    pending: enrichmentQueue.size,
    inProgress: enrichmentQueue.pending,
    recent: [...recentEnrichmentResults]
  };
}

function toObjectId(userId: Types.ObjectId | string): Types.ObjectId {
  if (userId instanceof Types.ObjectId) {
    return userId;
  }
  if (mongoose.isValidObjectId(userId)) {
    return new Types.ObjectId(userId);
  }
  throw new Error('Invalid userId for enrichment');
}

/** IGDB external_game category for store → IGDB game id */
function igdbCategoryFromSource(source: string): number | null {
  const s = source.toLowerCase();
  if (s.includes('steam')) return 1;
  if (s.includes('gog')) return 5;
  if (s.includes('epic')) return 26;
  return null;
}

function parseIgdbIdFromLinks(
  links?: { name?: string; url?: string }[]
): number | null {
  if (!links?.length) return null;
  const re = /igdb\.com\/games\/(\d+)/i;
  for (const l of links) {
    const url = l.url;
    if (!url) continue;
    const m = url.match(re);
    if (m) {
      const id = parseInt(m[1], 10);
      if (!Number.isNaN(id)) return id;
    }
  }
  return null;
}

function escapeSearchName(name: string): string {
  return name.trim().replace(/"/g, '\\"').slice(0, 120);
}

interface IgdbGameRow {
  id: number;
  name?: string;
  summary?: string;
  cover?: { url?: string };
}

interface IgdbExternalRow {
  game?: number;
}

export async function resolveIgdbIdFromGame(game: {
  gameId?: string;
  source: string;
  name: string;
  links?: { name?: string; url?: string }[];
}): Promise<{ id: number; matchKind: EnrichmentMatchKind } | null> {
  const uid = game.gameId?.trim();
  const category = igdbCategoryFromSource(game.source);

  if (uid && category != null) {
    const body = `fields game;\nwhere uid = "${uid.replace(/"/g, '')}" & category = ${category};\nlimit 1;\n`;
    const rows = await postIgdb<IgdbExternalRow[]>('external_games', body);
    const gid = rows?.[0]?.game;
    if (typeof gid === 'number' && gid > 0) {
      return { id: gid, matchKind: 'external_games' };
    }
  }

  const fromLink = parseIgdbIdFromLinks(game.links);
  if (fromLink != null) {
    return { id: fromLink, matchKind: 'links' };
  }

  const q = escapeSearchName(game.name);
  if (!q) return null;

  const searchBody = `fields name,summary,cover.url;\nsearch "${q}";\nwhere version_parent = null;\nlimit 1;\n`;
  const games = await postIgdb<IgdbGameRow[]>('games', searchBody);
  const row = games?.[0];
  if (row && typeof row.id === 'number' && row.id > 0) {
    return { id: row.id, matchKind: 'name_search' };
  }

  return null;
}

export async function fetchGameByIgdbId(
  igdbId: number
): Promise<IgdbGameRow | null> {
  const body = `fields name,summary,cover.url;\nwhere id = ${igdbId};\n`;
  const rows = await postIgdb<IgdbGameRow[]>('games', body);
  const row = rows?.[0];
  if (row && typeof row.id === 'number') {
    return row;
  }
  return null;
}

export function enqueueEnrichGame(
  userId: Types.ObjectId | string,
  mongoGameId: string
): void {
  const uid = toObjectId(userId);
  void enrichmentQueue.add(() => enrichGameForUser(uid, mongoGameId));
}

export async function enrichAllGamesForUser(
  userId: Types.ObjectId | string
): Promise<{ queued: number; skipped: number }> {
  const uid = toObjectId(userId);
  const games = await Game.find({ userId: uid })
    .select('_id igdbId coverImageUrl')
    .lean();

  let skipped = 0;
  let queued = 0;

  for (const g of games) {
    const id = g._id?.toString();
    if (!id) continue;
    if (g.igdbId != null && g.coverImageUrl) {
      skipped++;
      continue;
    }
    enqueueEnrichGame(uid, id);
    queued++;
  }

  return { queued, skipped };
}

export async function enrichGameForUser(
  userId: Types.ObjectId | string,
  mongoGameId: string
): Promise<void> {
  const started = Date.now();
  const uid = toObjectId(userId);

  try {
    const game = await Game.findOne({ _id: mongoGameId, userId: uid }).lean();
    if (!game) {
      console.warn(
        `[Enrichment] Failed gameId=${mongoGameId} error=Game not found`
      );
      pushRecent({
        at: new Date().toISOString(),
        gameMongoId: mongoGameId,
        gameName: '?',
        status: 'failed',
        error: 'Game not found',
        durationMs: Date.now() - started
      });
      return;
    }

    const gameName = game.name ?? mongoGameId;

    if (game.igdbId != null && game.coverImageUrl) {
      console.info(
        `[Enrichment] Skipped gameId=${mongoGameId} name="${gameName}" (already enriched)`
      );
      pushRecent({
        at: new Date().toISOString(),
        gameMongoId: mongoGameId,
        gameName,
        status: 'skipped',
        durationMs: Date.now() - started
      });
      return;
    }

    console.info(`[Enrichment] Started gameId=${mongoGameId} name="${gameName}"`);

    let resolvedId: number;
    let matchKind: EnrichmentMatchKind;

    if (game.igdbId != null && !game.coverImageUrl) {
      resolvedId = game.igdbId;
      matchKind = 'cached_igdb_id';
    } else {
      const resolved = await resolveIgdbIdFromGame({
        gameId: game.gameId,
        source: game.source,
        name: game.name,
        links: game.links
      });

      if (!resolved) {
        const msg = 'No IGDB match';
        console.warn(
          `[Enrichment] Failed gameId=${mongoGameId} name="${gameName}" error="${msg}"`
        );
        pushRecent({
          at: new Date().toISOString(),
          gameMongoId: mongoGameId,
          gameName,
          status: 'failed',
          error: msg,
          durationMs: Date.now() - started
        });
        return;
      }
      resolvedId = resolved.id;
      matchKind = resolved.matchKind;
    }

    const data = await fetchGameByIgdbId(resolvedId);
    if (!data) {
      const msg = 'IGDB game fetch empty';
      console.warn(
        `[Enrichment] Failed gameId=${mongoGameId} name="${gameName}" error="${msg}"`
      );
      pushRecent({
        at: new Date().toISOString(),
        gameMongoId: mongoGameId,
        gameName,
        status: 'failed',
        error: msg,
        durationMs: Date.now() - started
      });
      return;
    }

    const patch: Record<string, unknown> = {
      igdbId: data.id
    };

    const coverUrl = normalizeIgdbImageUrl(data.cover?.url);
    if (coverUrl) {
      patch.coverImageUrl = coverUrl;
    }
    if (data.summary != null && String(data.summary).trim() !== '') {
      patch.description = data.summary;
    }

    await Game.findOneAndUpdate(
      { _id: mongoGameId, userId: uid },
      { $set: patch }
    );

    const durationMs = Date.now() - started;
    console.info(
      `[Enrichment] Completed gameId=${mongoGameId} name="${gameName}" igdbId=${data.id} match=${matchKind} duration=${durationMs}ms`
    );
    pushRecent({
      at: new Date().toISOString(),
      gameMongoId: mongoGameId,
      gameName,
      status: 'completed',
      match: matchKind,
      durationMs
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error(`[Enrichment] Failed gameId=${mongoGameId} error="${err}"`, e);
    pushRecent({
      at: new Date().toISOString(),
      gameMongoId: mongoGameId,
      gameName: mongoGameId,
      status: 'failed',
      error: err,
      durationMs: Date.now() - started
    });
  }
}
