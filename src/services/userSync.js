import { authApi } from './authApi';

const STORAGE_KEYS = {
  library: 'kulturdb_library',
  topPicks: 'kulturdb_top_picks',
  ratings: 'moviedb_ratings',
  comments: 'kulturdb_comments_map',
  watchlist: 'moviedb_watchlist',
  roadmap: 'kulturdb_roadmap',
};

function hasAuthToken() {
  return Boolean(localStorage.getItem('authToken'));
}

function parseJsonSafe(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function collectCommentsMapFromLegacyKeys() {
  const result = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith('moviedb_comments_')) {
      continue;
    }

    const itemId = key.replace('moviedb_comments_', '');
    result[itemId] = parseJsonSafe(localStorage.getItem(key), []);
  }

  return result;
}

function applyCommentsMapToLegacyKeys(commentsMap) {
  if (!commentsMap || typeof commentsMap !== 'object' || Array.isArray(commentsMap)) {
    return;
  }

  Object.entries(commentsMap).forEach(([itemId, comments]) => {
    localStorage.setItem(`moviedb_comments_${itemId}`, JSON.stringify(Array.isArray(comments) ? comments : []));
  });

  localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(commentsMap));
}

export async function pullAndHydrateUserSyncData() {
  if (!hasAuthToken()) {
    return null;
  }

  try {
    const data = await authApi.getSyncData();
    const syncData = data?.syncData;
    if (!syncData) {
      return null;
    }

    if (Array.isArray(syncData.library)) {
      localStorage.setItem(STORAGE_KEYS.library, JSON.stringify(syncData.library));
    }

    if (Array.isArray(syncData.topPicks)) {
      localStorage.setItem(STORAGE_KEYS.topPicks, JSON.stringify(syncData.topPicks));
    }

    if (syncData.ratings && typeof syncData.ratings === 'object' && !Array.isArray(syncData.ratings)) {
      localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(syncData.ratings));
    }

    applyCommentsMapToLegacyKeys(syncData.comments);

    if (Array.isArray(syncData.watchlist)) {
      localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(syncData.watchlist));
    }

    if (Array.isArray(syncData.roadmap)) {
      localStorage.setItem(STORAGE_KEYS.roadmap, JSON.stringify(syncData.roadmap));
    }

    return syncData;
  } catch (_error) {
    return null;
  }
}

export async function pushUserSyncPatch(patch = {}) {
  if (!hasAuthToken()) {
    return null;
  }

  try {
    return await authApi.updateSyncData(patch);
  } catch (_error) {
    return null;
  }
}

export function getRatingsSnapshot() {
  return parseJsonSafe(localStorage.getItem(STORAGE_KEYS.ratings), {});
}

export function getCommentsSnapshot() {
  const explicitMap = parseJsonSafe(localStorage.getItem(STORAGE_KEYS.comments), null);
  if (explicitMap && typeof explicitMap === 'object' && !Array.isArray(explicitMap)) {
    return explicitMap;
  }

  return collectCommentsMapFromLegacyKeys();
}

export function getRoadmapSnapshot() {
  return parseJsonSafe(localStorage.getItem(STORAGE_KEYS.roadmap), []);
}
