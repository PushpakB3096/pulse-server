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

/** IGDB external_game category (legacy enum, still used by API) */
const IGDB_CAT = {
  steam: 1,
  gog: 5,
  epic: 26,
  microsoft: 11,
  playstation_us: 36,
  itch: 30,
  xbox_marketplace: 31
} as const;

/** Categories to try for a given Playnite library source string (order: specific first). */
function igdbCategoriesFromSource(source: string): number[] {
  const s = source.toLowerCase();
  const out: number[] = [];
  if (s.includes('steam')) out.push(IGDB_CAT.steam);
  if (s.includes('gog')) out.push(IGDB_CAT.gog);
  if (s.includes('epic')) out.push(IGDB_CAT.epic);
  if (s.includes('itch')) out.push(IGDB_CAT.itch);
  if (s.includes('playstation') || s.includes('psn') || /\bps store\b/.test(s)) {
    out.push(IGDB_CAT.playstation_us);
  }
  if (s.includes('microsoft') && !s.includes('xbox')) {
    out.push(IGDB_CAT.microsoft);
  }
  if (s.includes('xbox')) {
    out.push(IGDB_CAT.xbox_marketplace);
    out.push(IGDB_CAT.microsoft);
  }
  return [...new Set(out)];
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

/** Steam / GOG / Epic-style store URLs → external_game uid + category */
function parseStoreUidFromLinks(
  links?: { url?: string }[]
): Array<{ category: number; uid: string }> {
  const out: Array<{ category: number; uid: string }> = [];
  const seen = new Set<string>();
  const add = (category: number, uid: string) => {
    const k = `${category}:${uid}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ category, uid });
  };

  for (const l of links ?? []) {
    const u = l.url?.trim();
    if (!u) continue;

    const steam = u.match(/\/app\/(\d+)/i);
    if (
      steam &&
      /steampowered\.com|steamcommunity\.com|steamgames\.com/i.test(u)
    ) {
      add(IGDB_CAT.steam, steam[1]);
      continue;
    }

    const gogNum = u.match(/gog\.com\/(?:[a-z]{2}\/)?game\/(\d+)/i);
    if (gogNum) {
      add(IGDB_CAT.gog, gogNum[1]);
      continue;
    }

  }
  return out;
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

interface IgdbGameSearchRow {
  id: number;
  version_parent?: number;
}

interface IgdbExternalRow {
  game?: number;
}

async function lookupExternalGame(
  uid: string,
  category: number
): Promise<number | null> {
  const safeUid = uid.replace(/"/g, '');
  const body = `fields game;\nwhere uid = "${safeUid}" & category = ${category};\nlimit 1;\n`;
  const rows = await postIgdb<IgdbExternalRow[]>('external_games', body);
  const gid = rows?.[0]?.game;
  if (typeof gid === 'number' && gid > 0) {
    return gid;
  }
  return null;
}

/** Prefer canonical parent when this row is a version / port child */
function resolvedGameIdFromSearchRow(row: IgdbGameSearchRow): number {
  if (typeof row.version_parent === 'number' && row.version_parent > 0) {
    return row.version_parent;
  }
  return row.id;
}

/**
 * Ordered search candidates: sortingName first, then normalized variants
 * (edition stripping, subtitles, version tokens, colon heuristic).
 */
function normalizeGameTitleForIgdb(
  name: string,
  sortingName?: string | null
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (s: string | undefined | null) => {
    if (!s) return;
    const t = s.trim();
    if (t.length < 2) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const base = name.trim();
  add(sortingName?.trim());
  add(base);

  let s = base.replace(/\s+v\d+\.\d+(?:\.\d+)?\s*$/i, '').trim();
  add(s);
  s = s.replace(/\bv[\d.]+\s*$/i, '').trim();
  add(s);

  const editionRe =
    /\s*[\s\-–—:]\s*(?:Game of the Year Edition|GOTY Edition|GOTY|Ultimate Edition|Definitive Edition|Complete Edition|Deluxe Edition|Gold Edition|Premium Edition|Anniversary Edition)\s*$/i;
  add(base.replace(editionRe, '').trim());
  add(s.replace(editionRe, '').trim());

  const dashIdx = base.indexOf(' - ');
  if (dashIdx > 0) {
    add(base.slice(0, dashIdx).trim());
  }

  const colonIdx = base.indexOf(':');
  if (colonIdx > 0) {
    const after = base.slice(colonIdx + 1).trim();
    if (after.length > 25 || /role\s*playing|edition/i.test(after)) {
      add(base.slice(0, colonIdx).trim());
    }
  }

  const twoWord = /^([^\s:]+)\s+([^\s:]+)$/;
  const m = base.match(twoWord);
  if (m && !base.includes(':')) {
    add(`${m[1]}: ${m[2]}`);
  }

  if (/counter-strike/i.test(base)) {
    add('Counter-Strike');
    add('CS:GO');
  }

  return out;
}

async function searchIgdbNameToGameId(q: string): Promise<number | null> {
  const escaped = escapeSearchName(q);
  if (!escaped) return null;

  const withParent = `fields id,version_parent;\nsearch "${escaped}";\nwhere version_parent = null;\nlimit 3;\n`;
  let rows = await postIgdb<IgdbGameSearchRow[]>('games', withParent);
  if (rows?.length) {
    return resolvedGameIdFromSearchRow(rows[0]);
  }

  const withoutParent = `fields id,version_parent;\nsearch "${escaped}";\nlimit 3;\n`;
  rows = await postIgdb<IgdbGameSearchRow[]>('games', withoutParent);
  if (rows?.length) {
    return resolvedGameIdFromSearchRow(rows[0]);
  }

  return null;
}

export async function resolveIgdbIdFromGame(game: {
  gameId?: string;
  source: string;
  name: string;
  sortingName?: string | null;
  links?: { name?: string; url?: string }[];
}): Promise<{ id: number; matchKind: EnrichmentMatchKind } | null> {
  const uid = game.gameId?.trim();
  const categoriesFromSource = igdbCategoriesFromSource(game.source);

  if (uid && categoriesFromSource.length) {
    for (const cat of categoriesFromSource) {
      const gid = await lookupExternalGame(uid, cat);
      if (gid != null) {
        return { id: gid, matchKind: 'external_games' };
      }
    }
  }

  for (const { uid: linkUid, category } of parseStoreUidFromLinks(
    game.links
  )) {
    const gid = await lookupExternalGame(linkUid, category);
    if (gid != null) {
      return { id: gid, matchKind: 'external_games' };
    }
  }

  const fromLink = parseIgdbIdFromLinks(game.links);
  if (fromLink != null) {
    return { id: fromLink, matchKind: 'links' };
  }

  const candidates = normalizeGameTitleForIgdb(game.name, game.sortingName);
  for (const q of candidates) {
    const id = await searchIgdbNameToGameId(q);
    if (id != null) {
      return { id, matchKind: 'name_search' };
    }
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
        sortingName: game.sortingName,
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
