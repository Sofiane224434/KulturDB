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
  'with_genres=16',
  'with_genres=16&with_origin_country=JP',
  'with_genres=16&with_original_language=ja',
  'with_genres=16&with_original_language=ko',
  'with_genres=16&with_original_language=zh',
  'with_genres=16&with_origin_country=KR',
  'with_genres=16&with_origin_country=CN',
];

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

function isLikelyAnimeItem(item) {
  const originCountries = Array.isArray(item?.origin_country)
    ? item.origin_country.map((country) => String(country || '').toUpperCase())
    : [];
  const originalLanguage = String(item?.original_language || '').toLowerCase();
  const hasWhitelistedCountry = originCountries.some((country) => ANIME_COUNTRY_WHITELIST.has(country));
  const hasWhitelistedLanguage = ANIME_LANGUAGE_WHITELIST.has(originalLanguage);

  // Si TMDB a des metadonnees incomplètes, on garde l'item quand son titre original contient des caracteres CJK.
  const hasCjkTitle = hasBlockedTitleChars(item?.original_name || item?.name || '');

  return hasWhitelistedCountry || hasWhitelistedLanguage || hasCjkTitle;
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
    return response.json();
  },

  getTrendingMovies: async (timeWindow = 'week') => {
    const response = await fetch(`${BASE_URL}/trending/movie/${timeWindow}?api_key=${API_KEY}&language=fr-FR`);
    return response.json();
  },

  getMovieDetails: async (movieId) => {
    const response = await fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,similar,reviews,translations`);
    return response.json();
  },

  searchMovies: async (query, page = 1) => {
    const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&page=${page}`);
    return response.json();
  },

  // Séries
  getPopularSeries: async (page = 1, sortKey = 'popularity') => {
    const sortBy = resolveSortBy(sortKey, 'tv');
    const response = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&language=fr-FR&without_genres=16&sort_by=${sortBy}&page=${page}`);
    return response.json();
  },

  getTrendingSeries: async (timeWindow = 'week') => {
    const response = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&language=fr-FR&without_genres=16&sort_by=popularity.desc&page=1`);
    return response.json();
  },

  getSeriesDetails: async (seriesId) => {
    const response = await fetch(`${BASE_URL}/tv/${seriesId}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,similar,reviews,translations`);
    return response.json();
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
    return {
      ...data,
      results: Array.isArray(data?.results)
        ? data.results.filter((item) => !Array.isArray(item.genre_ids) || !item.genre_ids.includes(16))
        : [],
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

    return {
      ...referenceData,
      page,
      results: mergedResults,
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
