import { tmdbService } from '../services/tmdb';
import { getCommentsSnapshot, getRatingsSnapshot, getRoadmapSnapshot, pushUserSyncPatch } from '../services/userSync';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const ANILIST_URL = 'https://graphql.anilist.co';
const KITSU_BASE_URL = 'https://kitsu.io/api/edge';
const animeSignalCache = new Map();

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getYearFromDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isFinite(date.getFullYear()) ? date.getFullYear() : null;
}

function scoreJikanCandidate(titleNormalized, expectedYear, candidate) {
  const candidateTitleNormalized = normalizeForMatch(
    candidate?.title || candidate?.title_english || candidate?.title_japanese,
  );

  if (!candidateTitleNormalized) {
    return -Infinity;
  }

  let score = 0;
  if (candidateTitleNormalized === titleNormalized) {
    score += 7;
  }

  if (candidateTitleNormalized.includes(titleNormalized) || titleNormalized.includes(candidateTitleNormalized)) {
    score += 4;
  }

  if (candidateTitleNormalized.startsWith(titleNormalized) || titleNormalized.startsWith(candidateTitleNormalized)) {
    score += 2;
  }

  const candidateYear = getYearFromDate(candidate?.aired?.from);
  if (expectedYear && candidateYear) {
    const gap = Math.abs(expectedYear - candidateYear);
    if (gap === 0) {
      score += 2;
    } else if (gap <= 1) {
      score += 1;
    }
  }

  if (candidate?.type === 'TV') {
    score += 1;
  } else if (candidate?.type === 'Movie' || candidate?.type === 'TV Special' || candidate?.type === 'Special') {
    score -= 4;
  }

  return score;
}

function scoreGenericCandidate({ titleNormalized, expectedYear, candidateTitle, candidateYear, candidateType, prefersTv }) {
  const normalizedCandidateTitle = normalizeForMatch(candidateTitle);
  if (!normalizedCandidateTitle) {
    return -Infinity;
  }

  let score = 0;
  if (normalizedCandidateTitle === titleNormalized) {
    score += 7;
  }

  if (normalizedCandidateTitle.includes(titleNormalized) || titleNormalized.includes(normalizedCandidateTitle)) {
    score += 4;
  }

  if (normalizedCandidateTitle.startsWith(titleNormalized) || titleNormalized.startsWith(normalizedCandidateTitle)) {
    score += 2;
  }

  if (expectedYear && candidateYear) {
    const gap = Math.abs(expectedYear - candidateYear);
    if (gap === 0) {
      score += 2;
    } else if (gap <= 1) {
      score += 1;
    }
  }

  const normalizedType = String(candidateType || '').toUpperCase();
  if (prefersTv && normalizedType.includes('TV')) {
    score += 1;
  } else if (prefersTv && (normalizedType.includes('MOVIE') || normalizedType.includes('SPECIAL'))) {
    score -= 4;
  }

  return score;
}

function getManualAnimeEpisodeOverride(title) {
  const normalizedTitle = normalizeForMatch(title);

  if (normalizedTitle.includes('inazuma eleven go chrono stone') || normalizedTitle.includes('inazuma eleven go chrono stones')) {
    return {
      type: 'anime',
      progressTotal: 51,
      reason: 'manual_inazuma_chrono_stone',
    };
  }

  if (normalizedTitle.includes('inazuma eleven go galaxy')) {
    return {
      type: 'anime',
      progressTotal: 43,
      reason: 'manual_inazuma_galaxy',
    };
  }

  return null;
}

async function fetchJikanAnimeSignal({ title, year }) {
  const normalizedTitle = normalizeForMatch(title);
  if (!normalizedTitle) {
    return null;
  }

  const cacheKey = `${normalizedTitle}::${year || 'na'}`;
  if (animeSignalCache.has(cacheKey)) {
    return animeSignalCache.get(cacheKey);
  }

  try {
    const response = await fetch(`${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(title)}&limit=10&sfw=true`);
    const payload = await response.json();
    const candidates = Array.isArray(payload?.data) ? payload.data : [];

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = scoreJikanCandidate(normalizedTitle, year, candidate);
      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    const hasSolidMatch = bestCandidate && bestScore >= 5;
    const signal = hasSolidMatch
      ? {
          isAnime: true,
          episodes: Number.isFinite(bestCandidate?.episodes) ? bestCandidate.episodes : null,
          source: 'jikan',
        }
      : null;

    animeSignalCache.set(cacheKey, signal);
    return signal;
  } catch (_error) {
    animeSignalCache.set(cacheKey, null);
    return null;
  }
}

async function fetchAniListAnimeSignal({ title, year }) {
  const normalizedTitle = normalizeForMatch(title);
  if (!normalizedTitle) {
    return null;
  }

  const cacheKey = `anilist::${normalizedTitle}::${year || 'na'}`;
  if (animeSignalCache.has(cacheKey)) {
    return animeSignalCache.get(cacheKey);
  }

  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          episodes
          format
          seasonYear
          title {
            romaji
            english
            native
          }
          synonyms
        }
      }
    }
  `;

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: title },
      }),
    });

    const payload = await response.json();
    const candidates = Array.isArray(payload?.data?.Page?.media) ? payload.data.Page.media : [];

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const candidateTitles = [
        candidate?.title?.romaji,
        candidate?.title?.english,
        candidate?.title?.native,
        ...(Array.isArray(candidate?.synonyms) ? candidate.synonyms : []),
      ].filter(Boolean);

      for (const candidateTitle of candidateTitles) {
        const score = scoreGenericCandidate({
          titleNormalized: normalizedTitle,
          expectedYear: year,
          candidateTitle,
          candidateYear: Number.isFinite(candidate?.seasonYear) ? candidate.seasonYear : null,
          candidateType: candidate?.format,
          prefersTv: true,
        });

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
    }

    const hasSolidMatch = bestCandidate && bestScore >= 4;
    const signal = hasSolidMatch
      ? {
          isAnime: true,
          episodes: Number.isFinite(bestCandidate?.episodes) ? bestCandidate.episodes : null,
          source: 'anilist',
        }
      : null;

    animeSignalCache.set(cacheKey, signal);
    return signal;
  } catch (_error) {
    animeSignalCache.set(cacheKey, null);
    return null;
  }
}

async function fetchKitsuAnimeSignal({ title, year }) {
  const normalizedTitle = normalizeForMatch(title);
  if (!normalizedTitle) {
    return null;
  }

  const cacheKey = `kitsu::${normalizedTitle}::${year || 'na'}`;
  if (animeSignalCache.has(cacheKey)) {
    return animeSignalCache.get(cacheKey);
  }

  try {
    const response = await fetch(
      `${KITSU_BASE_URL}/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=10`,
      {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      },
    );
    const payload = await response.json();
    const candidates = Array.isArray(payload?.data) ? payload.data : [];

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const attributes = candidate?.attributes || {};
      const candidateTitles = [
        attributes.canonicalTitle,
        ...(Array.isArray(attributes.abbreviatedTitles) ? attributes.abbreviatedTitles : []),
      ].filter(Boolean);

      for (const candidateTitle of candidateTitles) {
        const score = scoreGenericCandidate({
          titleNormalized: normalizedTitle,
          expectedYear: year,
          candidateTitle,
          candidateYear: getYearFromDate(attributes.startDate),
          candidateType: attributes.subtype,
          prefersTv: true,
        });

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
    }

    const attributes = bestCandidate?.attributes || {};
    const hasSolidMatch = bestCandidate && bestScore >= 4;
    const signal = hasSolidMatch
      ? {
          isAnime: true,
          episodes: Number.isFinite(attributes?.episodeCount) ? attributes.episodeCount : null,
          source: 'kitsu',
        }
      : null;

    animeSignalCache.set(cacheKey, signal);
    return signal;
  } catch (_error) {
    animeSignalCache.set(cacheKey, null);
    return null;
  }
}

function isTmdbAnimeDetails(details) {
  const genreIds = Array.isArray(details?.genres) ? details.genres.map((genre) => genre.id) : [];
  const originCountries = Array.isArray(details?.origin_country) ? details.origin_country : [];
  const originalLanguage = String(details?.original_language || '').toLowerCase();

  return genreIds.includes(16) && (originCountries.includes('JP') || originalLanguage === 'ja');
}

async function getAnimeCrossSignal({ title, year, details }) {
  const tmdbSaysAnime = isTmdbAnimeDetails(details);
  const [jikanSignal, aniListSignal, kitsuSignal] = await Promise.all([
    fetchJikanAnimeSignal({ title, year }),
    fetchAniListAnimeSignal({ title, year }),
    fetchKitsuAnimeSignal({ title, year }),
  ]);

  const providers = [jikanSignal, aniListSignal, kitsuSignal].filter(Boolean);

  return {
    isAnime: tmdbSaysAnime || providers.length > 0,
    jikanEpisodes: Number.isFinite(jikanSignal?.episodes) ? jikanSignal.episodes : null,
    aniListEpisodes: Number.isFinite(aniListSignal?.episodes) ? aniListSignal.episodes : null,
    kitsuEpisodes: Number.isFinite(kitsuSignal?.episodes) ? kitsuSignal.episodes : null,
  };
}

function buildSeasonBreakdown(details) {
  if (!Array.isArray(details?.seasons)) {
    return [];
  }

  return details.seasons
    .filter((season) => season.season_number > 0 && Number.isFinite(season.episode_count) && season.episode_count > 0)
    .map((season) => ({
      seasonNumber: season.season_number,
      episodeCount: season.episode_count,
    }));
}

function sumSeasonEpisodes(seasonBreakdown) {
  return seasonBreakdown.reduce((total, season) => total + (Number.isFinite(season.episodeCount) ? season.episodeCount : 0), 0);
}

export async function resolveSeriesAnimeMetadata({
  id,
  preferredType = 'series',
  title,
  year,
  details,
}) {
  const resolvedDetails = details || (id ? await tmdbService.getSeriesDetails(id) : null);
  if (!resolvedDetails) {
    return {
      type: preferredType === 'anime' ? 'anime' : 'series',
      progressTotal: null,
      seasonBreakdown: [],
      episodeRuntimeMinutes: null,
      metadataSyncedAt: Date.now(),
    };
  }

  const seasonBreakdown = buildSeasonBreakdown(resolvedDetails);
  const tmdbEpisodes = Number.isFinite(resolvedDetails?.number_of_episodes) && resolvedDetails.number_of_episodes > 0
    ? resolvedDetails.number_of_episodes
    : null;
  const seasonEpisodes = sumSeasonEpisodes(seasonBreakdown);

  const crossSignal = await getAnimeCrossSignal({
    title: title || resolvedDetails?.name || resolvedDetails?.original_name,
    year: Number.isFinite(year) ? year : getYearFromDate(resolvedDetails?.first_air_date),
    details: resolvedDetails,
  });

  const manualOverride = getManualAnimeEpisodeOverride(title || resolvedDetails?.name || resolvedDetails?.original_name);

  const mergedEpisodeTotal = Math.max(
    tmdbEpisodes || 0,
    seasonEpisodes || 0,
    crossSignal.jikanEpisodes || 0,
    crossSignal.aniListEpisodes || 0,
    crossSignal.kitsuEpisodes || 0,
  ) || null;

  return {
    type: manualOverride?.type || (preferredType === 'anime' || crossSignal.isAnime ? 'anime' : 'series'),
    progressTotal: manualOverride?.progressTotal || mergedEpisodeTotal,
    seasonBreakdown,
    episodeRuntimeMinutes: Array.isArray(resolvedDetails?.episode_run_time)
      ? resolvedDetails.episode_run_time.find((value) => Number.isFinite(value) && value > 0) || null
      : null,
    metadataSyncedAt: Date.now(),
  };
}

// Hook pour gérer les tops (films, series, anime, manga, etc.)
export const useTopPicks = () => {
  const TOP_PICKS_KEY = 'kulturdb_top_picks';
  const LEGACY_FAVORITES_KEY = 'moviedb_favorites';

  const normalizeTopItem = (item) => ({
    ...item,
    id: String(item.id),
    type: item.type || 'movie',
    title: tmdbService.getSafeDisplayTitle(item.title, item.name, item.original_title, item.original_name),
    addedAt: item.addedAt || Date.now(),
  });

  const migrateLegacyFavorites = () => {
    const legacyFavorites = localStorage.getItem(LEGACY_FAVORITES_KEY);
    if (!legacyFavorites) {
      return [];
    }

    const parsedLegacy = JSON.parse(legacyFavorites);
    const migrated = Array.isArray(parsedLegacy)
      ? parsedLegacy.map((item) => normalizeTopItem(item))
      : [];

    localStorage.setItem(TOP_PICKS_KEY, JSON.stringify(migrated));
    return migrated;
  };

  const getTopPicks = () => {
    const topPicks = localStorage.getItem(TOP_PICKS_KEY);
    if (topPicks) {
      const parsed = JSON.parse(topPicks);
      return Array.isArray(parsed) ? parsed.map((item) => normalizeTopItem(item)) : [];
    }

    return migrateLegacyFavorites();
  };

  const saveTopPicks = (topPicks) => {
    localStorage.setItem(TOP_PICKS_KEY, JSON.stringify(topPicks));
    pushUserSyncPatch({ topPicks });
    return topPicks;
  };

  const replaceTopPick = (id, currentType, patch = {}) => {
    const normalizedId = String(id);
    const topPicks = getTopPicks();
    const updated = topPicks.map((entry) => {
      if (entry.id !== normalizedId || entry.type !== currentType) {
        return entry;
      }

      return normalizeTopItem({
        ...entry,
        ...patch,
      });
    });

    return saveTopPicks(updated);
  };

  const moveTopPick = (id, type, direction) => {
    const normalizedId = String(id);
    const topPicks = getTopPicks();
    const matchingIndexes = topPicks
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === type);

    const currentGroupIndex = matchingIndexes.findIndex(({ entry }) => entry.id === normalizedId);
    if (currentGroupIndex === -1) {
      return topPicks;
    }

    const targetGroupIndex = direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;
    if (targetGroupIndex < 0 || targetGroupIndex >= matchingIndexes.length) {
      return topPicks;
    }

    const fromIndex = matchingIndexes[currentGroupIndex].index;
    const toIndex = matchingIndexes[targetGroupIndex].index;
    const updated = [...topPicks];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    return saveTopPicks(updated);
  };

  const refreshTopPickTypes = async () => {
    let topPicks = getTopPicks();
    let hasChanges = false;

    for (const item of topPicks) {
      if (item.type !== 'series') {
        continue;
      }

      try {
        const details = await tmdbService.getSeriesDetails(item.id);
        const crossSignal = await getAnimeCrossSignal({
          title: item.title || details?.name || details?.original_name,
          year: Number.isFinite(item.year) ? item.year : getYearFromDate(details?.first_air_date),
          details,
        });

        if (crossSignal.isAnime) {
          topPicks = replaceTopPick(item.id, 'series', { type: 'anime' });
          hasChanges = true;
        }
      } catch (_error) {
        // Ignore partial failures to keep tops accessible.
      }
    }

    return hasChanges ? getTopPicks() : topPicks;
  };

  const addToTopPicks = (item, type) => {
    const topPicks = getTopPicks();
    const normalizedId = String(item.id);

    if (topPicks.some((entry) => entry.id === normalizedId && entry.type === type)) {
      return topPicks;
    }

    const newTop = normalizeTopItem({ ...item, id: normalizedId, type, addedAt: Date.now() });
    return saveTopPicks([newTop, ...topPicks]);
  };

  const removeFromTopPicks = (id, type = null) => {
    const normalizedId = String(id);
    const topPicks = getTopPicks();
    const updated = topPicks.filter((entry) => {
      if (type) {
        return !(entry.id === normalizedId && entry.type === type);
      }
      return entry.id !== normalizedId;
    });
    return saveTopPicks(updated);
  };

  const isInTopPicks = (id, type = null) => {
    const normalizedId = String(id);
    const topPicks = getTopPicks();
    return topPicks.some((entry) => (type ? entry.id === normalizedId && entry.type === type : entry.id === normalizedId));
  };

  return { getTopPicks, addToTopPicks, removeFromTopPicks, isInTopPicks, moveTopPick, refreshTopPickTypes };
};

// Alias legacy pour compatibilite du code existant
export const useFavorites = () => {
  const { getTopPicks, addToTopPicks, removeFromTopPicks, isInTopPicks } = useTopPicks();

  return {
    getFavorites: getTopPicks,
    addFavorite: addToTopPicks,
    removeFavorite: removeFromTopPicks,
    isFavorite: isInTopPicks,
  };
};

// Hook pour gérer les commentaires
export const useComments = () => {
  const normalizeComment = (comment) => ({
    id: comment?.id || Date.now(),
    text: String(comment?.text || ''),
    parentId: comment?.parentId || null,
    createdAt: Number.isFinite(comment?.createdAt) ? comment.createdAt : Date.now(),
    author: comment?.author || 'Utilisateur',
    visibility: comment?.visibility === 'private' ? 'private' : 'public',
  });

  const syncComments = () => {
    pushUserSyncPatch({ comments: getCommentsSnapshot() });
  };

  const getComments = (itemId) => {
    const comments = localStorage.getItem(`moviedb_comments_${itemId}`);
    const parsed = comments ? JSON.parse(comments) : [];
    return Array.isArray(parsed) ? parsed.map((entry) => normalizeComment(entry)) : [];
  };

  const addComment = (itemId, text, parentId = null, visibility = 'public') => {
    const comments = getComments(itemId);
    const newComment = normalizeComment({
      id: Date.now(),
      text,
      parentId,
      createdAt: Date.now(),
      author: 'Utilisateur',
      visibility,
    });
    const updated = [...comments, newComment];
    localStorage.setItem(`moviedb_comments_${itemId}`, JSON.stringify(updated));
    syncComments();
    return updated;
  };

  const deleteComment = (itemId, commentId) => {
    const comments = getComments(itemId);
    const updated = comments.filter(c => c.id !== commentId && c.parentId !== commentId);
    localStorage.setItem(`moviedb_comments_${itemId}`, JSON.stringify(updated));
    syncComments();
    return updated;
  };

  return { getComments, addComment, deleteComment };
};

// Hook pour gérer les notations
export const useRatings = () => {
  const getRatings = () => {
    const ratings = localStorage.getItem('moviedb_ratings');
    return ratings ? JSON.parse(ratings) : {};
  };

  const getRating = (itemId) => {
    const ratings = getRatings();
    return ratings[itemId] || 0;
  };

  const setRating = (itemId, rating) => {
    const ratings = getRatings();
    ratings[itemId] = rating;
    localStorage.setItem('moviedb_ratings', JSON.stringify(ratings));
    pushUserSyncPatch({ ratings });
    return rating;
  };

  const removeRating = (itemId) => {
    const ratings = getRatings();
    delete ratings[itemId];
    localStorage.setItem('moviedb_ratings', JSON.stringify(ratings));
    pushUserSyncPatch({ ratings });
  };

  return { getRating, setRating, removeRating, getRatings };
};

// Hook pour gérer la watchlist
export const useWatchlist = () => {
  const normalizeItem = (item) => ({
    ...item,
    status: item.status || 'to_start',
    progressCurrent: Number.isFinite(item.progressCurrent) ? item.progressCurrent : 0,
    progressTotal: Number.isFinite(item.progressTotal) ? item.progressTotal : null,
    progressUnit: item.progressUnit || 'episode',
    hasSeen: Boolean(item.hasSeen),
    wantRewatch: Boolean(item.wantRewatch),
    personalNote: item.personalNote || '',
    publicComment: item.publicComment || '',
    personalRating: Number.isFinite(item.personalRating) ? item.personalRating : 0,
    scanAvailable: Boolean(item.scanAvailable),
    imdbRating: Number.isFinite(item.imdbRating) ? item.imdbRating : null,
  });

  const getWatchlist = () => {
    const watchlist = localStorage.getItem('moviedb_watchlist');
    const parsed = watchlist ? JSON.parse(watchlist) : [];
    return parsed.map(normalizeItem);
  };

  const saveWatchlist = (items) => {
    localStorage.setItem('moviedb_watchlist', JSON.stringify(items));
    pushUserSyncPatch({ watchlist: items });
    return items;
  };

  const addToWatchlist = (item, type) => {
    const watchlist = getWatchlist();
    const defaultUnit = type === 'movie' ? 'film' : 'episode';
    const newItem = normalizeItem({ ...item, type, addedAt: Date.now(), status: 'to_start', progressUnit: defaultUnit });
    const updated = [...watchlist, newItem];
    return saveWatchlist(updated);
  };

  const addManualEntry = (payload) => {
    const watchlist = getWatchlist();
    const generatedId = Date.now();
    const progressUnit = payload.progressUnit || 'chapitre';
    const newItem = normalizeItem({
      id: generatedId,
      type: payload.type,
      title: payload.title,
      poster_path: null,
      addedAt: Date.now(),
      status: payload.status || 'to_start',
      progressCurrent: payload.progressCurrent ?? 0,
      progressTotal: payload.progressTotal ?? null,
      progressUnit,
      scanAvailable: Boolean(payload.scanAvailable),
      imdbRating: Number.isFinite(payload.imdbRating) ? payload.imdbRating : null,
      publicComment: payload.publicComment || '',
      personalNote: payload.personalNote || '',
      personalRating: payload.personalRating ?? 0,
      hasSeen: Boolean(payload.hasSeen),
      wantRewatch: Boolean(payload.wantRewatch),
      isManual: true,
    });

    const updated = [...watchlist, newItem];
    return saveWatchlist(updated);
  };

  const removeFromWatchlist = (id, type = null) => {
    const watchlist = getWatchlist();
    const updated = watchlist.filter(item => {
      if (type) {
        return !(item.id === id && item.type === type);
      }
      return item.id !== id;
    });
    return saveWatchlist(updated);
  };

  const updateWatchlistStatus = (id, status, type = null) => {
    const watchlist = getWatchlist();
    const updated = watchlist.map(item => 
      (type ? item.id === id && item.type === type : item.id === id) ? { ...item, status } : item
    );
    return saveWatchlist(updated);
  };

  const updateWatchlistItem = (id, patch, type = null) => {
    const watchlist = getWatchlist();
    const updated = watchlist.map(item => {
      const match = type ? item.id === id && item.type === type : item.id === id;
      if (!match) {
        return item;
      }
      return normalizeItem({ ...item, ...patch });
    });
    return saveWatchlist(updated);
  };

  const isInWatchlist = (id, type = null) => {
    const watchlist = getWatchlist();
    return watchlist.some(item => (type ? item.id === id && item.type === type : item.id === id));
  };

  return {
    getWatchlist,
    addToWatchlist,
    addManualEntry,
    removeFromWatchlist,
    updateWatchlistStatus,
    updateWatchlistItem,
    isInWatchlist,
  };
};

// Hook pour gerer la roadmap personnelle (chronologique et manuelle)
export const useRoadmap = () => {
  const ROADMAP_KEY = 'kulturdb_roadmap';

  const normalizeRoadmapItem = (item, index = 0) => ({
    id: String(item?.id || `${Date.now()}-${index}`),
    refId: item?.refId != null ? String(item.refId) : null,
    type: item?.type || 'movie',
    title: tmdbService.getSafeDisplayTitle(item?.title, item?.name, item?.original_title, item?.original_name),
    poster_path: item?.poster_path || item?.posterPath || null,
    image: item?.image || null,
    progressCurrent: Number.isFinite(item?.progressCurrent) ? item.progressCurrent : 0,
    progressTotal: Number.isFinite(item?.progressTotal) ? item.progressTotal : null,
    progressUnit: item?.progressUnit || 'element',
    sourceStatus: item?.sourceStatus || 'to_start',
    plannedFor: item?.plannedFor || null,
    createdAt: Number.isFinite(item?.createdAt) ? item.createdAt : Date.now(),
    order: Number.isFinite(item?.order) ? item.order : index,
  });

  const getRoadmap = () => {
    const raw = localStorage.getItem(ROADMAP_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((item, index) => normalizeRoadmapItem(item, index))
      : [];
  };

  const saveRoadmap = (items) => {
    const normalized = (Array.isArray(items) ? items : []).map((item, index) => normalizeRoadmapItem(item, index));
    localStorage.setItem(ROADMAP_KEY, JSON.stringify(normalized));
    pushUserSyncPatch({ roadmap: normalized });
    return normalized;
  };

  const addRoadmapItem = (item, type = 'movie', plannedFor = null) => {
    const roadmap = getRoadmap();
    const refId = item?.id != null ? String(item.id) : null;
    const duplicate = roadmap.find((entry) => entry.type === type && entry.refId && refId && entry.refId === refId);
    if (duplicate) {
      return roadmap;
    }

    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      refId,
      type,
      title: item?.title || item?.name || 'Titre indisponible',
      poster_path: item?.poster_path || null,
      image: item?.image || null,
      progressCurrent: Number.isFinite(item?.progressCurrent) ? item.progressCurrent : 0,
      progressTotal: Number.isFinite(item?.progressTotal) ? item.progressTotal : null,
      progressUnit: item?.progressUnit || (type === 'movie' ? 'film' : 'episode'),
      sourceStatus: item?.status || 'to_start',
      plannedFor,
      createdAt: Date.now(),
      order: roadmap.length,
    };

    return saveRoadmap([...roadmap, next]);
  };

  const addManualRoadmapItem = ({ title, type = 'movie', plannedFor = null }) => {
    const roadmap = getRoadmap();
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      return roadmap;
    }

    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      refId: null,
      type,
      title: cleanTitle,
      poster_path: null,
      image: null,
      progressCurrent: 0,
      progressTotal: null,
      progressUnit: type === 'movie' ? 'film' : 'element',
      sourceStatus: 'manual',
      plannedFor,
      createdAt: Date.now(),
      order: roadmap.length,
    };

    return saveRoadmap([...roadmap, next]);
  };

  const removeRoadmapItem = (roadmapId) => {
    const roadmap = getRoadmap();
    const updated = roadmap.filter((entry) => entry.id !== String(roadmapId));
    return saveRoadmap(updated);
  };

  const moveRoadmapItem = (roadmapId, direction = 'up') => {
    const roadmap = getRoadmap();
    const index = roadmap.findIndex((entry) => entry.id === String(roadmapId));
    if (index < 0) {
      return roadmap;
    }

    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= roadmap.length) {
      return roadmap;
    }

    const next = [...roadmap];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return saveRoadmap(next);
  };

  return {
    getRoadmap,
    addRoadmapItem,
    addManualRoadmapItem,
    removeRoadmapItem,
    moveRoadmapItem,
  };
};

// Hook pour gerer la bibliotheque publique (visionnage + lecture)
export const useLibrary = () => {
  const LIBRARY_KEY = 'kulturdb_library';
  const LEGACY_WATCHLIST_KEY = 'moviedb_watchlist';
  const METADATA_TTL_MS = 1000 * 60 * 60 * 6;

  const buildDetailPath = (id, type) => {
    if (type === 'movie') {
      return `/movie/${id}`;
    }

    if (type === 'series' || type === 'anime') {
      return `/series/${id}`;
    }

    return `/reading/${type}/${id}`;
  };

  const normalizeLibraryItem = (item) => {
    const inferredTitle = tmdbService.getSafeDisplayTitle(item.title, item.name, item.original_title, item.original_name);
    const inferredType = item.type || 'movie';

    return {
      id: String(item.id),
      type: inferredType,
      title: inferredTitle,
      image: item.image || null,
      poster_path: item.poster_path || null,
      year: item.year || null,
      status: item.status || 'to_start',
      progressCurrent: Number.isFinite(item.progressCurrent) ? item.progressCurrent : 0,
      progressTotal: Number.isFinite(item.progressTotal) ? item.progressTotal : null,
      seasonBreakdown: Array.isArray(item.seasonBreakdown) ? item.seasonBreakdown : [],
      runtimeMinutes: Number.isFinite(item.runtimeMinutes) ? item.runtimeMinutes : null,
      episodeRuntimeMinutes: Number.isFinite(item.episodeRuntimeMinutes) ? item.episodeRuntimeMinutes : null,
      metadataSyncedAt: Number.isFinite(item.metadataSyncedAt) ? item.metadataSyncedAt : null,
      progressUnit: item.progressUnit || 'element',
      notes: item.notes || '',
      source: item.source || null,
      detailPath: item.detailPath || buildDetailPath(item.id, inferredType),
      addedAt: item.addedAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
    };
  };

  const getLibrary = () => {
    const current = localStorage.getItem(LIBRARY_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      return Array.isArray(parsed) ? parsed.map(normalizeLibraryItem) : [];
    }

    // Migration silencieuse de l'ancienne watchlist vers la bibliotheque
    const legacy = localStorage.getItem(LEGACY_WATCHLIST_KEY);
    if (!legacy) {
      return [];
    }

    const migrated = (JSON.parse(legacy) || []).map(normalizeLibraryItem);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
    return migrated;
  };

  const saveLibrary = (items) => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
    pushUserSyncPatch({
      library: items,
      topPicks: JSON.parse(localStorage.getItem('kulturdb_top_picks') || '[]'),
      ratings: getRatingsSnapshot(),
      comments: getCommentsSnapshot(),
      watchlist: JSON.parse(localStorage.getItem('moviedb_watchlist') || '[]'),
      roadmap: getRoadmapSnapshot(),
    });
    return items;
  };

  const addToLibrary = (item, type, extra = {}) => {
    const library = getLibrary();
    const normalizedId = String(item.id);
    const existing = library.find((entry) => entry.id === normalizedId && entry.type === type);

    if (existing) {
      return library;
    }

    const nextItem = normalizeLibraryItem({
      id: normalizedId,
      type,
      title: item.title || item.name,
      image: item.image || null,
      poster_path: item.poster_path || null,
      year: item.year || null,
      source: item.source || null,
      detailPath: buildDetailPath(normalizedId, type),
      ...extra,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return saveLibrary([nextItem, ...library]);
  };

  const removeFromLibrary = (id, type) => {
    const library = getLibrary();
    const normalizedId = String(id);
    const updated = library.filter((entry) => !(entry.id === normalizedId && entry.type === type));
    return saveLibrary(updated);
  };

  const isInLibrary = (id, type) => {
    const normalizedId = String(id);
    return getLibrary().some((entry) => entry.id === normalizedId && entry.type === type);
  };

  const updateLibraryItem = (id, type, patch = {}) => {
    const library = getLibrary();
    const normalizedId = String(id);
    const updated = library.map((entry) => {
      if (entry.id !== normalizedId || entry.type !== type) {
        return entry;
      }

      return normalizeLibraryItem({
        ...entry,
        ...patch,
        updatedAt: Date.now(),
      });
    });

    return saveLibrary(updated);
  };

  const needsMetadataRefresh = (item, force = false) => {
    if (!item || !['movie', 'series', 'anime'].includes(item.type)) {
      return false;
    }

    if (force) {
      return true;
    }

    const syncedAt = Number.isFinite(item.metadataSyncedAt) ? item.metadataSyncedAt : 0;
    const isStale = !syncedAt || Date.now() - syncedAt > METADATA_TTL_MS;

    if (item.type === 'movie') {
      return isStale || !Number.isFinite(item.runtimeMinutes) || item.runtimeMinutes <= 0;
    }

    return (
      isStale ||
      !Number.isFinite(item.progressTotal) ||
      item.progressTotal <= 0 ||
      !Array.isArray(item.seasonBreakdown) ||
      item.seasonBreakdown.length === 0 ||
      !Number.isFinite(item.episodeRuntimeMinutes) ||
      item.episodeRuntimeMinutes <= 0
    );
  };

  const fetchMetadataPatch = async (item) => {
    if (item.type === 'movie') {
      const details = await tmdbService.getMovieDetails(item.id);
      return {
        runtimeMinutes: Number.isFinite(details?.runtime) && details.runtime > 0 ? details.runtime : null,
        progressTotal: 1,
        progressUnit: 'film',
        metadataSyncedAt: Date.now(),
      };
    }

    const resolved = await resolveSeriesAnimeMetadata({
      id: item.id,
      preferredType: item.type,
      title: item.title,
      year: item.year,
    });

    return {
      type: resolved.type,
      progressTotal: resolved.progressTotal,
      seasonBreakdown: resolved.seasonBreakdown,
      episodeRuntimeMinutes: resolved.episodeRuntimeMinutes,
      progressUnit: 'episode',
      metadataSyncedAt: resolved.metadataSyncedAt,
    };
  };

  const replaceLibraryItem = (id, currentType, patch = {}) => {
    const normalizedId = String(id);
    const library = getLibrary();
    const updated = library.map((entry) => {
      if (entry.id !== normalizedId || entry.type !== currentType) {
        return entry;
      }

      return normalizeLibraryItem({
        ...entry,
        ...patch,
        detailPath: buildDetailPath(normalizedId, patch.type || entry.type),
        updatedAt: Date.now(),
      });
    });

    return saveLibrary(updated);
  };

  const refreshLibraryMetadata = async ({ force = false } = {}) => {
    let library = getLibrary();
    const itemsToRefresh = library.filter((item) => needsMetadataRefresh(item, force) || item.type === 'series');

    if (itemsToRefresh.length === 0) {
      return library;
    }

    for (const item of itemsToRefresh) {
      try {
        const patch = await fetchMetadataPatch(item);
        library = replaceLibraryItem(item.id, item.type, patch);
      } catch (_error) {
        // Ignore TMDB refresh failures to keep the library usable offline/partial.
      }
    }

    return library;
  };

  return {
    getLibrary,
    addToLibrary,
    removeFromLibrary,
    updateLibraryItem,
    isInLibrary,
    refreshLibraryMetadata,
  };
};
