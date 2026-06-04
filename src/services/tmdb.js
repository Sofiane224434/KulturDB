import { authApi } from './authApi';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = import.meta.env.VITE_TMDB_BASE_URL;
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const MOVIE_SORT_MAP = {
  popularity: 'popularity.desc',
  rating_desc: 'vote_average.desc',
  rating_asc: 'vote_average.asc',
  alpha_asc: 'title.asc',
  alpha_desc: 'title.desc',
};

const TV_SORT_MAP = {
  popularity: 'popularity.desc',
  rating_desc: 'vote_average.desc',
  rating_asc: 'vote_average.asc',
  alpha_asc: 'name.asc',
  alpha_desc: 'name.desc',
};

const BLOCKED_TITLE_CHARS_REGEX = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const ANIME_RESULTS_LIMIT = 60;
const ANIME_COUNTRY_WHITELIST = new Set(['JP', 'KR', 'CN', 'TW']);
const ANIME_LANGUAGE_WHITELIST = new Set(['ja', 'ko', 'zh']);
const ANIME_DISCOVER_VARIANTS = [
  'with_genres=16&with_origin_country=JP',
  'with_genres=16&with_original_language=ja',
  'with_genres=16&with_original_language=ko',
  'with_genres=16&with_original_language=zh',
  'with_genres=16&with_origin_country=KR',
  'with_genres=16&with_origin_country=CN',
];
const OVERRIDE_CACHE_TTL_MS = 60_000;

let cachedCatalogOverrides = null;
let cachedCatalogOverridesAt = 0;
const overrideByRefCache = new Map();

function normalizeTitleValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasBlockedTitleChars(value) {
  return BLOCKED_TITLE_CHARS_REGEX.test(String(value || ''));
}

function stripBlockedTitleChars(value) {
  return normalizeTitleValue(String(value || '').replace(BLOCKED_TITLE_CHARS_REGEX, ''));
}

function getSafeDisplayTitle(...candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeTitleValue(candidate);
    if (!normalized) {
      continue;
    }

    if (!hasBlockedTitleChars(normalized)) {
      return normalized;
    }
  }

  for (const candidate of candidates) {
    const stripped = stripBlockedTitleChars(candidate);
    if (stripped) {
      return stripped;
    }
  }

  return 'Titre indisponible';
}

function sortAnimeResults(results, sortKey = 'popularity') {
  const list = [...results];

  list.sort((left, right) => {
    if (sortKey === 'rating_desc') {
      return (right.vote_average || 0) - (left.vote_average || 0);
    }

    if (sortKey === 'rating_asc') {
      return (left.vote_average || 0) - (right.vote_average || 0);
    }

    const leftTitle = getSafeDisplayTitle(left?.name, left?.original_name);
    const rightTitle = getSafeDisplayTitle(right?.name, right?.original_name);

    if (sortKey === 'alpha_asc') {
      return leftTitle.localeCompare(rightTitle, 'fr');
    }

    if (sortKey === 'alpha_desc') {
      return rightTitle.localeCompare(leftTitle, 'fr');
    }

    return (right.popularity || 0) - (left.popularity || 0);
  });

  return list;
}

function resolveSortBy(sortKey, mediaType = 'tv') {
  const map = mediaType === 'movie' ? MOVIE_SORT_MAP : TV_SORT_MAP;
  return map[sortKey] || map.popularity;
}

function toTmdbId(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.trunc(numeric);
}

function toSeasonCountMap(seasonBreakdown) {
  if (!Array.isArray(seasonBreakdown)) {
    return new Map();
  }

  const map = new Map();
  seasonBreakdown.forEach((entry) => {
    const seasonNumber = Number(entry?.seasonNumber);
    const episodeCount = Number(entry?.episodeCount);
    if (Number.isFinite(seasonNumber) && seasonNumber > 0 && Number.isFinite(episodeCount) && episodeCount > 0) {
      map.set(Math.trunc(seasonNumber), Math.trunc(episodeCount));
    }
  });

  return map;
}

function applyEntryOverrides(item, entry, mediaType) {
  if (!item || !entry) {
    return item;
  }

  const next = {
    ...item,
    media_type: mediaType === 'series' ? 'tv' : (mediaType === 'anime' ? 'tv' : mediaType),
  };

  if (entry.title) {
    if (mediaType === 'movie') {
      next.title = entry.title;
      next.original_title = entry.title;
    } else {
      next.name = entry.title;
      next.original_name = entry.title;
    }
  }

  if (entry.overview) {
    next.overview = entry.overview;
  }

  if (entry.posterPath) {
    next.poster_path = entry.posterPath;
  }

  if (entry.backdropPath) {
    next.backdrop_path = entry.backdropPath;
  }

  if (Number.isFinite(entry.episodesTotal) && entry.episodesTotal > 0) {
    next.number_of_episodes = entry.episodesTotal;
  }

  const seasonMap = toSeasonCountMap(entry.seasonBreakdown);
  if (Array.isArray(next.seasons) && seasonMap.size > 0) {
    next.seasons = next.seasons.map((season) => {
      const seasonNumber = Number(season?.season_number);
      if (Number.isFinite(seasonNumber) && seasonMap.has(Math.trunc(seasonNumber))) {
        return {
          ...season,
          episode_count: seasonMap.get(Math.trunc(seasonNumber)),
        };
      }
      return season;
    });
  }

  return next;
}

async function getCatalogOverrides() {
  const now = Date.now();
  if (cachedCatalogOverrides && now - cachedCatalogOverridesAt < OVERRIDE_CACHE_TTL_MS) {
    return cachedCatalogOverrides;
  }

  try {
    const data = await authApi.getMediaCatalogOverrides();
    cachedCatalogOverrides = {
      hiddenRefs: Array.isArray(data?.hiddenRefs) ? data.hiddenRefs : [],
      forcedEntries: Array.isArray(data?.forcedEntries) ? data.forcedEntries : [],
    };
  } catch (_error) {
    cachedCatalogOverrides = { hiddenRefs: [], forcedEntries: [] };
  }

  cachedCatalogOverridesAt = now;
  return cachedCatalogOverrides;
}

async function getMediaOverride(mediaType, mediaRefId) {
  const cacheKey = `${mediaType}:${mediaRefId}`;
  const now = Date.now();
  const existing = overrideByRefCache.get(cacheKey);
  if (existing && now - existing.fetchedAt < OVERRIDE_CACHE_TTL_MS) {
    return existing.value;
  }

  let value = null;
  try {
    const data = await authApi.getMediaOverride(mediaType, mediaRefId);
    value = data?.override || null;
  } catch (_error) {
    value = null;
  }

  overrideByRefCache.set(cacheKey, { value, fetchedAt: now });
  return value;
}

function applyCatalogOverrides(items, mediaType, forcedEntries) {
  const safeItems = Array.isArray(items) ? items : [];
  const hiddenSet = new Set();
  const forcedById = new Map();

  (forcedEntries || []).forEach((entry) => {
    if (entry?.mediaType !== mediaType) {
      return;
    }
    const tmdbId = toTmdbId(entry.mediaRefId);
    if (!Number.isFinite(tmdbId)) {
      return;
    }
    forcedById.set(tmdbId, entry);
  });

  (cachedCatalogOverrides?.hiddenRefs || []).forEach((ref) => {
    if (ref?.mediaType !== mediaType) {
      return;
    }
    const tmdbId = toTmdbId(ref.mediaRefId);
    if (Number.isFinite(tmdbId)) {
      hiddenSet.add(tmdbId);
    }
  });

  const next = [];
  const seen = new Set();

  safeItems.forEach((item) => {
    const itemId = toTmdbId(item?.id);
    if (!Number.isFinite(itemId) || hiddenSet.has(itemId)) {
      return;
    }
    const forced = forcedById.get(itemId);
    next.push(applyEntryOverrides(item, forced, mediaType));
    seen.add(itemId);
  });

  forcedById.forEach((entry, entryId) => {
    if (seen.has(entryId) || hiddenSet.has(entryId)) {
      return;
    }
    next.unshift(applyEntryOverrides({
      id: entryId,
      name: entry.title || `Fiche ${entryId}`,
      title: entry.title || `Fiche ${entryId}`,
      overview: entry.overview || '',
      poster_path: entry.posterPath || null,
      backdrop_path: entry.backdropPath || null,
    }, entry, mediaType));
  });

  return next;
}

function isLikelyAnimeItem(item) {
  const originCountries = Array.isArray(item?.origin_country)
    ? item.origin_country.map((country) => String(country || '').toUpperCase())
    : [];
  const originalLanguage = String(item?.original_language || '').toLowerCase();
  const hasWhitelistedCountry = originCountries.some((country) => ANIME_COUNTRY_WHITELIST.has(country));
  const hasWhitelistedLanguage = ANIME_LANGUAGE_WHITELIST.has(originalLanguage);

  // Filtre volontairement strict: uniquement signaux geographiques/linguistiques anime.
  return hasWhitelistedCountry || hasWhitelistedLanguage;
}

async function fetchAnimeDiscoverVariant(query, page, sortBy) {
  const response = await fetch(
    `${BASE_URL}/discover/tv?api_key=${API_KEY}&language=fr-FR&include_adult=false&sort_by=${sortBy}&page=${page}&${query}`,
  );

  if (!response.ok) {
    throw new Error(`TMDB discover failed for ${query}`);
  }

  return response.json();
}

export const tmdbService = {
  // Films
  getPopularMovies: async (page = 1, sortKey = 'popularity') => {
    const sortBy = resolveSortBy(sortKey, 'movie');
    const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&language=fr-FR&include_adult=false&sort_by=${sortBy}&page=${page}`);
    const data = await response.json();
    const overrides = await getCatalogOverrides();
    return {
      ...data,
      results: applyCatalogOverrides(data?.results, 'movie', overrides.forcedEntries),
    };
  },

  getTrendingMovies: async (timeWindow = 'week') => {
    const response = await fetch(`${BASE_URL}/trending/movie/${timeWindow}?api_key=${API_KEY}&language=fr-FR`);
    return response.json();
  },

  getMovieDetails: async (movieId) => {
    const response = await fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,similar,reviews,translations`);
    const data = await response.json();
    const override = await getMediaOverride('movie', movieId);
    return applyEntryOverrides(data, override, 'movie');
  },

  searchMovies: async (query, page = 1) => {
    const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=${page}`);
    return response.json();
  },

  // Séries
  getPopularSeries: async (page = 1, sortKey = 'popularity') => {
    const sortBy = resolveSortBy(sortKey, 'tv');
    const response = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&language=fr-FR&without_genres=16&sort_by=${sortBy}&page=${page}`);
    const data = await response.json();
    const overrides = await getCatalogOverrides();
    return {
      ...data,
      results: applyCatalogOverrides(data?.results, 'series', overrides.forcedEntries),
    };
  },

  getTrendingSeries: async (timeWindow = 'week') => {
    const response = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&language=fr-FR&without_genres=16&sort_by=popularity.desc&page=1`);
    return response.json();
  },

  getSeriesDetails: async (seriesId) => {
    const response = await fetch(`${BASE_URL}/tv/${seriesId}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,similar,reviews,translations`);
    const data = await response.json();
    const override = await getMediaOverride('series', seriesId) || await getMediaOverride('anime', seriesId);
    return applyEntryOverrides(data, override, 'series');
  },

  // Détails d'une saison
  getSeasonDetails: async (seriesId, seasonNumber) => {
    const response = await fetch(`${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${API_KEY}&language=fr-FR`);
    return response.json();
  },

  // Personnes (acteurs, réalisateurs, etc.)
  getPersonDetails: async (personId) => {
    const response = await fetch(`${BASE_URL}/person/${personId}?api_key=${API_KEY}&language=fr-FR&append_to_response=combined_credits`);
    return response.json();
  },

  searchSeries: async (query, page = 1) => {
    const response = await fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=${page}`);
    const data = await response.json();
    const overrides = await getCatalogOverrides();
    const filtered = Array.isArray(data?.results)
      ? data.results.filter((item) => !Array.isArray(item.genre_ids) || !item.genre_ids.includes(16))
      : [];

    return {
      ...data,
      results: applyCatalogOverrides(filtered, 'series', overrides.forcedEntries),
    };
  },

  // Recherche multi (films + séries)
  searchMulti: async (query) => {
    const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`);
    return response.json();
  },

  // Anime (films et séries d'animation japonaise)
  getAnime: async (page = 1, sortKey = 'popularity') => {
    // Fusionne plusieurs variantes discover pour limiter les manques quand TMDB tague mal l'origine ou la langue.
    const sortBy = resolveSortBy(sortKey, 'tv');
    const responses = await Promise.allSettled(
      ANIME_DISCOVER_VARIANTS.map((query) => fetchAnimeDiscoverVariant(query, page, sortBy)),
    );

    const successfulResults = responses
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (successfulResults.length === 0) {
      throw new Error('TMDB anime indisponible');
    }

    const mergedMap = new Map();
    const allResults = successfulResults.flatMap((dataset) => (
      Array.isArray(dataset?.results) ? dataset.results : []
    ));

    for (const item of allResults) {
      if (!item?.id) {
        continue;
      }
      mergedMap.set(item.id, item);
    }

    const filteredResults = Array.from(mergedMap.values()).filter(isLikelyAnimeItem);
    const mergedResults = sortAnimeResults(filteredResults, sortKey).slice(0, ANIME_RESULTS_LIMIT);

    const referenceData = successfulResults[0] || {};
    const totalPages = successfulResults.reduce((maxPages, dataset) => {
      const currentPages = Number(dataset?.total_pages) || 1;
      return Math.max(maxPages, currentPages);
    }, 1);
    const totalResults = successfulResults.reduce((maxResults, dataset) => {
      const currentResults = Number(dataset?.total_results) || 0;
      return Math.max(maxResults, currentResults);
    }, 0);

    const overrides = await getCatalogOverrides();
    const withOverrides = applyCatalogOverrides(mergedResults, 'anime', overrides.forcedEntries);

    return {
      ...referenceData,
      page,
      results: withOverrides,
      total_pages: totalPages,
      total_results: totalResults,
    };
  },

  // Vidéos/Trailers
  getMovieVideos: async (movieId) => {
    const response = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`);
    return response.json();
  },

  getSeriesVideos: async (seriesId) => {
    const response = await fetch(`${BASE_URL}/tv/${seriesId}/videos?api_key=${API_KEY}`);
    return response.json();
  },

  getImageUrl: (path, size = 'w500') => {
    return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
  },

  getSafeDisplayTitle,

  getMediaTitle: (item, mediaType = 'tv') => {
    if (mediaType === 'movie') {
      return getSafeDisplayTitle(item?.title, item?.original_title);
    }

    return getSafeDisplayTitle(item?.name, item?.title, item?.original_name, item?.original_title);
  },
};
