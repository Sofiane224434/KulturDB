import { tmdbService } from '../services/tmdb';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
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
  }

  return score;
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

function isTmdbAnimeDetails(details) {
  const genreIds = Array.isArray(details?.genres) ? details.genres.map((genre) => genre.id) : [];
  const originCountries = Array.isArray(details?.origin_country) ? details.origin_country : [];
  const originalLanguage = String(details?.original_language || '').toLowerCase();

  return genreIds.includes(16) && (originCountries.includes('JP') || originalLanguage === 'ja');
}

async function getAnimeCrossSignal({ title, year, details }) {
  const tmdbSaysAnime = isTmdbAnimeDetails(details);
  const jikanSignal = await fetchJikanAnimeSignal({ title, year });

  return {
    isAnime: tmdbSaysAnime || Boolean(jikanSignal?.isAnime),
    jikanEpisodes: Number.isFinite(jikanSignal?.episodes) ? jikanSignal.episodes : null,
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
    title: item.title || item.name || 'Titre indisponible',
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
  const getComments = (itemId) => {
    const comments = localStorage.getItem(`moviedb_comments_${itemId}`);
    return comments ? JSON.parse(comments) : [];
  };

  const addComment = (itemId, text, parentId = null) => {
    const comments = getComments(itemId);
    const newComment = {
      id: Date.now(),
      text,
      parentId,
      createdAt: Date.now(),
      author: 'Utilisateur'
    };
    const updated = [...comments, newComment];
    localStorage.setItem(`moviedb_comments_${itemId}`, JSON.stringify(updated));
    return updated;
  };

  const deleteComment = (itemId, commentId) => {
    const comments = getComments(itemId);
    const updated = comments.filter(c => c.id !== commentId && c.parentId !== commentId);
    localStorage.setItem(`moviedb_comments_${itemId}`, JSON.stringify(updated));
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
    return rating;
  };

  const removeRating = (itemId) => {
    const ratings = getRatings();
    delete ratings[itemId];
    localStorage.setItem('moviedb_ratings', JSON.stringify(ratings));
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

  const addToWatchlist = (item, type) => {
    const watchlist = getWatchlist();
    const defaultUnit = type === 'movie' ? 'film' : 'episode';
    const newItem = normalizeItem({ ...item, type, addedAt: Date.now(), status: 'to_start', progressUnit: defaultUnit });
    const updated = [...watchlist, newItem];
    localStorage.setItem('moviedb_watchlist', JSON.stringify(updated));
    return updated;
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
    localStorage.setItem('moviedb_watchlist', JSON.stringify(updated));
    return updated;
  };

  const removeFromWatchlist = (id, type = null) => {
    const watchlist = getWatchlist();
    const updated = watchlist.filter(item => {
      if (type) {
        return !(item.id === id && item.type === type);
      }
      return item.id !== id;
    });
    localStorage.setItem('moviedb_watchlist', JSON.stringify(updated));
    return updated;
  };

  const updateWatchlistStatus = (id, status, type = null) => {
    const watchlist = getWatchlist();
    const updated = watchlist.map(item => 
      (type ? item.id === id && item.type === type : item.id === id) ? { ...item, status } : item
    );
    localStorage.setItem('moviedb_watchlist', JSON.stringify(updated));
    return updated;
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
    localStorage.setItem('moviedb_watchlist', JSON.stringify(updated));
    return updated;
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
    const inferredTitle = item.title || item.name || 'Titre indisponible';
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

    const details = await tmdbService.getSeriesDetails(item.id);
    const tmdbEpisodes = Number.isFinite(details?.number_of_episodes) && details.number_of_episodes > 0
      ? details.number_of_episodes
      : null;

    const crossSignal = await getAnimeCrossSignal({
      title: item.title || details?.name || details?.original_name,
      year: Number.isFinite(item.year) ? item.year : getYearFromDate(details?.first_air_date),
      details,
    });

    const mergedEpisodeTotal = Math.max(
      tmdbEpisodes || 0,
      crossSignal.jikanEpisodes || 0,
    ) || null;

    return {
      type: crossSignal.isAnime ? 'anime' : 'series',
      progressTotal: mergedEpisodeTotal,
      seasonBreakdown: Array.isArray(details?.seasons)
        ? details.seasons
            .filter((season) => season.season_number > 0 && Number.isFinite(season.episode_count) && season.episode_count > 0)
            .map((season) => ({
              seasonNumber: season.season_number,
              episodeCount: season.episode_count,
            }))
        : [],
      episodeRuntimeMinutes: Array.isArray(details?.episode_run_time)
        ? details.episode_run_time.find((value) => Number.isFinite(value) && value > 0) || null
        : null,
      progressUnit: 'episode',
      metadataSyncedAt: Date.now(),
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
