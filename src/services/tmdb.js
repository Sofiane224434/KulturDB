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

function resolveSortBy(sortKey, mediaType = 'tv') {
  const map = mediaType === 'movie' ? MOVIE_SORT_MAP : TV_SORT_MAP;
  return map[sortKey] || map.popularity;
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
    // Genre 16 = Animation, pays JP = Japon
    const sortBy = resolveSortBy(sortKey, 'tv');
    const response = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&language=fr-FR&with_genres=16&with_origin_country=JP&sort_by=${sortBy}&page=${page}`);
    return response.json();
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
  }
};
