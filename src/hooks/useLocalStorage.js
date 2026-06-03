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

  return { getTopPicks, addToTopPicks, removeFromTopPicks, isInTopPicks };
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

  return {
    getLibrary,
    addToLibrary,
    removeFromLibrary,
    updateLibraryItem,
    isInLibrary,
  };
};
