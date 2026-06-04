import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLibrary, useRoadmap, useTopPicks } from '../hooks/useLocalStorage';
import { tmdbService } from '../services/tmdb';
import { readingApi } from '../services/readingApi';

const MEDIA_LABELS = {
  movie: 'Films',
  series: 'Series',
  anime: 'Anime',
  manga: 'Manga',
  manwha: 'Manwha',
  light_novel: 'Light Novel',
  roman: 'Roman',
};

function makeMediaKey(id, type) {
  return `${String(type || 'media')}::${String(id || '')}`;
}

function toRoadmapSourceKey(item) {
  const refId = item?.refId || item?.id;
  if (!refId) {
    return null;
  }
  return `${String(item?.type || 'media')}::${String(refId)}`;
}

function getRoadmapPath(item) {
  const mediaId = item?.refId || item?.id;
  const isManual = !item?.refId && item?.sourceStatus === 'manual';
  if (!mediaId || isManual) {
    return null;
  }

  if (item?.type === 'movie') {
    return `/movie/${mediaId}`;
  }

  if (item?.type === 'series' || item?.type === 'anime') {
    return `/series/${mediaId}`;
  }

  return `/reading/${item?.type}/${mediaId}`;
}

function normalizeRecommendationItem(item, fallbackType = 'movie') {
  const mediaType = item?.media_type || item?.type || fallbackType;
  const normalizedType = mediaType === 'tv' ? fallbackType : mediaType;
  return {
    id: String(item?.id || item?.mal_id || item?.workKey || ''),
    type: normalizedType,
    title: item?.title || item?.name || 'Titre indisponible',
    posterPath: item?.poster_path || null,
    image: item?.image || null,
    voteAverage: Number(item?.vote_average || item?.score || 0),
    voteCount: Number(item?.vote_count || 0),
    popularity: Number(item?.popularity || 0),
  };
}

function getVoteVolumePenalty(item, hasUserRatingsSignal) {
  if (!hasUserRatingsSignal) {
    return 0;
  }

  if (!['movie', 'series', 'anime'].includes(item?.type)) {
    return 0;
  }

  const voteCount = Number(item?.voteCount || 0);
  if (!Number.isFinite(voteCount) || voteCount <= 0) {
    return 160;
  }
  if (voteCount <= 5) {
    return 140;
  }
  if (voteCount <= 20) {
    return 120;
  }
  if (voteCount <= 50) {
    return 75;
  }
  if (voteCount <= 100) {
    return 35;
  }
  return 0;
}

function getTrustedVoteScore(item) {
  const voteAverage = Number(item?.voteAverage || 0);
  const voteCount = Number(item?.voteCount || 0);
  if (!Number.isFinite(voteAverage) || voteAverage <= 0) {
    return 0;
  }

  const confidence = Math.max(0.05, Math.min(voteCount / 300, 1));
  return voteAverage * confidence;
}

function normalizePlanningSearchEntry(item, fallbackType = 'movie') {
  const normalized = normalizeRecommendationItem(item, fallbackType);
  const finalType = normalized.type === 'tv' ? fallbackType : normalized.type;

  return {
    ...normalized,
    type: finalType,
    progressUnit: finalType === 'movie' ? 'film' : 'element',
    sourceStatus: 'to_start',
  };
}

function parseRatingsSnapshot() {
  const raw = localStorage.getItem('moviedb_ratings');
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function tokenizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !['avec', 'pour', 'dans', 'the', 'this', 'that', 'from'].includes(token));
}

function getCanonicalRoadmapOrder(items) {
  return [...(Array.isArray(items) ? items : [])]
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left?.order) ? left.order : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right?.order) ? right.order : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      const leftCreated = Number.isFinite(left?.createdAt) ? left.createdAt : 0;
      const rightCreated = Number.isFinite(right?.createdAt) ? right.createdAt : 0;
      return leftCreated - rightCreated;
    });
}

function getTypeGroups(entries, roadmapEntries, ratingsMap) {
  const weights = new Map();

  const addWeight = (type, value) => {
    if (!type || !Number.isFinite(value) || value <= 0) {
      return;
    }
    weights.set(type, (weights.get(type) || 0) + value);
  };

  entries.forEach((entry) => {
    const type = entry?.type;
    const itemId = entry?.id;
    const ratingBonus = Number(ratingsMap?.[itemId] || 0) * 12;

    if (entry?.source === 'top') {
      addWeight(type, 140 + ratingBonus);
      return;
    }

    if (entry?.status === 'done') {
      addWeight(type, 110 + ratingBonus);
      return;
    }

    if (entry?.status === 'in_progress') {
      addWeight(type, 90 + ratingBonus);
      return;
    }

    if (entry?.status === 'to_resume') {
      addWeight(type, 75 + ratingBonus);
    }
  });

  roadmapEntries.forEach((entry) => addWeight(entry?.type, 35));

  const orderedTypes = Array.from(weights.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([type]) => type);

  const screenTypes = orderedTypes.filter((type) => ['movie', 'series', 'anime'].includes(type));
  const readingTypes = orderedTypes.filter((type) => ['manga', 'manwha', 'light_novel', 'roman'].includes(type));

  const screenScore = screenTypes.reduce((sum, type) => sum + (weights.get(type) || 0), 0);
  const readingScore = readingTypes.reduce((sum, type) => sum + (weights.get(type) || 0), 0);

  if (screenScore >= readingScore) {
    return {
      targetTypes: screenTypes.slice(0, 2).length ? screenTypes.slice(0, 2) : ['movie', 'series'],
      weights,
      mode: 'screen',
    };
  }

  return {
    targetTypes: readingTypes.slice(0, 2).length ? readingTypes.slice(0, 2) : ['manga', 'roman'],
    weights,
    mode: 'reading',
  };
}

function getTitleSimilarityScore(titleTokens, candidateTitle) {
  if (!titleTokens.size) {
    return 0;
  }
  const tokens = tokenizeTitle(candidateTitle);
  if (!tokens.length) {
    return 0;
  }
  let overlaps = 0;
  tokens.forEach((token) => {
    if (titleTokens.has(token)) {
      overlaps += 1;
    }
  });
  return overlaps / tokens.length;
}

function getRoadmapPosterUrl(item) {
  const tmdbPosterPath = item?.poster_path || item?.posterPath;
  if (tmdbPosterPath) {
    return tmdbService.getImageUrl(tmdbPosterPath, 'w342');
  }
  return item?.image || null;
}

function Planning() {
  const { isAuthenticated, user } = useAuth();
  const { getLibrary } = useLibrary();
  const { getRoadmap, addRoadmapItem, removeRoadmapItem, moveRoadmapItem, reorderRoadmapItem } = useRoadmap();
  const { getTopPicks } = useTopPicks();

  const [roadmapItems, setRoadmapItems] = useState([]);
  const [roadmapCandidates, setRoadmapCandidates] = useState([]);
  const [planningQuery, setPlanningQuery] = useState('');
  const [planningSearchType, setPlanningSearchType] = useState('all');
  const [planningSearchResults, setPlanningSearchResults] = useState([]);
  const [loadingPlanningSearch, setLoadingPlanningSearch] = useState(false);
  const [roadmapFilter, setRoadmapFilter] = useState('all');
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [draggedRoadmapId, setDraggedRoadmapId] = useState('');

  useEffect(() => {
    const library = getLibrary();
    setRoadmapItems(getCanonicalRoadmapOrder(getRoadmap()));
    setRoadmapCandidates(
      library
        .filter((item) => item && (item?.progressCurrent === 0 || String(item?.status || '').toLowerCase() === 'to_resume'))
        .slice(0, 16),
    );
  }, [isAuthenticated, user?.id]);

  const roadmapTypeCounts = useMemo(() => {
    const counts = {};
    roadmapItems.forEach((item) => {
      const type = item?.type || 'movie';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [roadmapItems]);

  const roadmapFilters = useMemo(
    () => ['all', ...Object.keys(roadmapTypeCounts)],
    [roadmapTypeCounts],
  );

  const filteredRoadmapItems = useMemo(() => {
    if (roadmapFilter === 'all') {
      return roadmapItems;
    }
    return roadmapItems.filter((item) => item?.type === roadmapFilter);
  }, [roadmapItems, roadmapFilter]);

  useEffect(() => {
    let cancelled = false;

    const loadRecommendations = async () => {
      if (!isAuthenticated) {
        setRecommendedItems([]);
        return;
      }

      setLoadingRecommendations(true);

      try {
        const library = getLibrary();
        const topPicks = getTopPicks();
        const roadmap = getRoadmap();
        const ratingsMap = parseRatingsSnapshot();
        const hasUserRatingsSignal = Object.keys(ratingsMap || {}).length > 0;
        const allSignals = [
          ...topPicks.map((entry) => ({ ...entry, source: 'top' })),
          ...library,
        ];
        const titleTokens = new Set(
          allSignals
            .slice(0, 30)
            .flatMap((entry) => tokenizeTitle(entry?.title || entry?.name)),
        );
        const preferenceModel = getTypeGroups(allSignals, roadmap, ratingsMap);

        const blocked = new Set(
          [
            ...library.map((entry) => makeMediaKey(entry.id, entry.type)),
            ...topPicks.map((entry) => makeMediaKey(entry.id, entry.type)),
            ...roadmap.map((entry) => toRoadmapSourceKey(entry)).filter(Boolean),
          ],
        );

        const tmdbSeeds = [];
        topPicks
          .filter((entry) => ['movie', 'series', 'anime'].includes(entry?.type))
          .slice(0, 6)
          .forEach((entry) => tmdbSeeds.push({
            id: entry.id,
            type: entry.type === 'movie' ? 'movie' : 'series',
            preferredType: entry.type,
            weight: 180,
          }));

        library
          .filter((entry) => ['done', 'in_progress', 'to_resume'].includes(entry?.status) && ['movie', 'series', 'anime'].includes(entry?.type))
          .slice(0, 8)
          .forEach((entry) => tmdbSeeds.push({
            id: entry.id,
            type: entry.type === 'movie' ? 'movie' : 'series',
            preferredType: entry.type,
            weight: entry.status === 'done' ? 120 : 95,
          }));

        const candidates = [];

        if (preferenceModel.mode === 'screen' && tmdbSeeds.length > 0) {
          const seedResults = await Promise.allSettled(
            tmdbSeeds.map(async (seed) => {
              const details = seed.type === 'movie'
                ? await tmdbService.getMovieDetails(seed.id)
                : await tmdbService.getSeriesDetails(seed.id);
              const similar = Array.isArray(details?.similar?.results) ? details.similar.results : [];
              const seedGenres = Array.isArray(details?.genres)
                ? details.genres.map((genre) => Number(genre?.id)).filter((genreId) => Number.isFinite(genreId))
                : [];
              return { seed, similar, seedGenres };
            }),
          );

          seedResults.forEach((result) => {
            if (result.status !== 'fulfilled') {
              return;
            }

            const { seed, similar, seedGenres } = result.value;
            similar.slice(0, 14).forEach((entry) => {
              const isAnimeSeed = seed.preferredType === 'anime';
              const fallbackType = isAnimeSeed ? 'anime' : (seed.type === 'movie' ? 'movie' : 'series');
              const normalized = normalizeRecommendationItem(entry, fallbackType);
              const key = makeMediaKey(normalized.id, normalized.type);
              const aliasKey = normalized.type === 'anime'
                ? makeMediaKey(normalized.id, 'series')
                : (normalized.type === 'series' ? makeMediaKey(normalized.id, 'anime') : null);
              if (!normalized.id || blocked.has(key) || (aliasKey && blocked.has(aliasKey))) {
                return;
              }

              if (!preferenceModel.targetTypes.includes(normalized.type)) {
                return;
              }

              const candidateGenres = Array.isArray(entry?.genre_ids)
                ? entry.genre_ids.map((genreId) => Number(genreId)).filter((genreId) => Number.isFinite(genreId))
                : [];
              const overlapCount = candidateGenres.filter((genreId) => seedGenres.includes(genreId)).length;
              const overlapScore = seedGenres.length ? overlapCount / seedGenres.length : 0;
              const titleSimilarity = getTitleSimilarityScore(titleTokens, normalized.title);
              const typeWeight = preferenceModel.weights.get(normalized.type) || 0;

              candidates.push({
                ...normalized,
                key,
                score: seed.weight
                  + typeWeight * 0.18
                  + getTrustedVoteScore(normalized) * 11
                  + Math.min(normalized.popularity, 150) * 0.5
                  + overlapScore * 40
                  + titleSimilarity * 35
                  - getVoteVolumePenalty(normalized, hasUserRatingsSignal),
              });
            });
          });
        }

        const fallbackCalls = [];
        preferenceModel.targetTypes.forEach((type) => {
          if (type === 'movie') {
            fallbackCalls.push({
              type,
              promise: tmdbService.getTrendingMovies('week'),
            });
          } else if (type === 'series') {
            fallbackCalls.push({
              type,
              promise: tmdbService.getTrendingSeries('week'),
            });
          } else if (type === 'anime') {
            fallbackCalls.push({
              type,
              promise: tmdbService.getAnime(1, 'rating_desc'),
            });
          } else if (type === 'manga') {
            fallbackCalls.push({ type, promise: readingApi.getMangas(1) });
          } else if (type === 'manwha') {
            fallbackCalls.push({ type, promise: readingApi.getManwha(1) });
          } else if (type === 'light_novel') {
            fallbackCalls.push({ type, promise: readingApi.getLightNovels(1) });
          } else if (type === 'roman') {
            fallbackCalls.push({ type, promise: readingApi.getRomans(1) });
          }
        });

        const fallbackResults = await Promise.allSettled(fallbackCalls.map((entry) => entry.promise));
        fallbackResults.forEach((result, index) => {
          if (result.status !== 'fulfilled') {
            return;
          }

          const targetType = fallbackCalls[index]?.type;
          const items = Array.isArray(result.value?.results) ? result.value.results : [];
          items.slice(0, 16).forEach((entry) => {
            const normalized = normalizeRecommendationItem(entry, targetType);
            const key = makeMediaKey(normalized.id, normalized.type);
            const aliasKey = normalized.type === 'anime'
              ? makeMediaKey(normalized.id, 'series')
              : (normalized.type === 'series' ? makeMediaKey(normalized.id, 'anime') : null);
            if (!normalized.id || blocked.has(key) || (aliasKey && blocked.has(aliasKey))) {
              return;
            }

            const titleSimilarity = getTitleSimilarityScore(titleTokens, normalized.title);
            const typeWeight = preferenceModel.weights.get(normalized.type) || 0;
            candidates.push({
              ...normalized,
              key,
              score: typeWeight * 0.25
                + getTrustedVoteScore(normalized) * 8
                + Math.min(normalized.popularity, 140) * 0.4
                + titleSimilarity * 30
                - getVoteVolumePenalty(normalized, hasUserRatingsSignal),
            });
          });
        });

        const deduped = new Map();
        candidates.forEach((entry) => {
          const existing = deduped.get(entry.key);
          if (!existing || entry.score > existing.score) {
            deduped.set(entry.key, entry);
          }
        });

        const nextRecommendations = Array.from(deduped.values())
          .sort((left, right) => right.score - left.score)
          .slice(0, 5);

        if (!cancelled) {
          setRecommendedItems(nextRecommendations);
        }
      } catch {
        if (!cancelled) {
          setRecommendedItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecommendations(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const searchPlanningEntries = async () => {
      const query = String(planningQuery || '').trim();
      if (query.length < 2) {
        setPlanningSearchResults([]);
        return;
      }

      setLoadingPlanningSearch(true);

      try {
        let entries = [];

        if (planningSearchType === 'movie') {
          const data = await tmdbService.searchMovies(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'movie'));
        } else if (planningSearchType === 'series') {
          const data = await tmdbService.searchSeries(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'series'));
        } else if (planningSearchType === 'anime') {
          const data = await tmdbService.searchAnime(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'anime'));
        } else if (planningSearchType === 'manga') {
          const data = await readingApi.searchMangas(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'manga'));
        } else if (planningSearchType === 'manwha') {
          const data = await readingApi.searchManwha(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'manwha'));
        } else if (planningSearchType === 'light_novel') {
          const data = await readingApi.searchLightNovels(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'light_novel'));
        } else if (planningSearchType === 'roman') {
          const data = await readingApi.searchRomans(query, 1);
          entries = (Array.isArray(data?.results) ? data.results : []).map((entry) => normalizePlanningSearchEntry(entry, 'roman'));
        } else {
          const data = await tmdbService.searchMulti(query);
          const raw = Array.isArray(data?.results) ? data.results : [];
          entries = raw
            .filter((entry) => entry?.media_type === 'movie' || entry?.media_type === 'tv')
            .map((entry) => normalizePlanningSearchEntry(entry, entry.media_type === 'movie' ? 'movie' : 'series'));
        }

        const deduped = new Map();
        entries.forEach((entry) => {
          const key = makeMediaKey(entry.id, entry.type);
          if (!entry?.id || deduped.has(key)) {
            return;
          }
          deduped.set(key, entry);
        });

        if (!cancelled) {
          setPlanningSearchResults(Array.from(deduped.values()).slice(0, 12));
        }
      } catch {
        if (!cancelled) {
          setPlanningSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPlanningSearch(false);
        }
      }
    };

    const timer = setTimeout(searchPlanningEntries, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [planningQuery, planningSearchType]);

  const refreshRoadmapState = () => {
    const sorted = getCanonicalRoadmapOrder(getRoadmap());
    setRoadmapItems(sorted);
  };

  const handleAddRoadmapFromCandidate = (item) => {
    addRoadmapItem(item, item?.type || 'movie');
    refreshRoadmapState();
  };

  const handleAddRoadmapFromSearch = (item) => {
    addRoadmapItem(item, item?.type || 'movie');
    setPlanningQuery('');
    setPlanningSearchResults([]);
    refreshRoadmapState();
  };

  const handleRemoveRoadmap = (roadmapId) => {
    removeRoadmapItem(roadmapId);
    refreshRoadmapState();
  };

  const handleMoveRoadmap = (roadmapId, direction) => {
    moveRoadmapItem(roadmapId, direction);
    refreshRoadmapState();
  };

  const handleRoadmapDrop = (targetRoadmapId) => {
    if (!draggedRoadmapId || draggedRoadmapId === targetRoadmapId) {
      setDraggedRoadmapId('');
      return;
    }

    reorderRoadmapItem(draggedRoadmapId, targetRoadmapId);
    setDraggedRoadmapId('');
    refreshRoadmapState();
  };

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
          Planning
        </h1>

        {isAuthenticated ? (
          <section className="border-2 border-gray-300 bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-1">Roadmap</p>
                <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700">Schema de progression: prochain puis suivant</h2>
              </div>
              <span className="font-serif text-sm text-gray-500">{roadmapItems.length} element(s)</span>
            </div>

            <div className="border border-gray-300 bg-gray-50 p-4 mb-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Ajouter un titre existant par recherche</p>
              <div className="grid md:grid-cols-[1fr_160px] gap-2 mb-2">
                <input
                  type="search"
                  value={planningQuery}
                  onChange={(event) => setPlanningQuery(event.target.value)}
                  placeholder="Rechercher un titre existant"
                  className="px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                />
                <select
                  value={planningSearchType}
                  onChange={(event) => setPlanningSearchType(event.target.value)}
                  className="px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                >
                  <option value="all">Tout (films/series)</option>
                  <option value="movie">Film</option>
                  <option value="series">Serie</option>
                  <option value="anime">Anime</option>
                  <option value="manga">Manga</option>
                  <option value="manwha">Manwha</option>
                  <option value="light_novel">Light Novel</option>
                  <option value="roman">Roman</option>
                </select>
              </div>
              {loadingPlanningSearch ? (
                <p className="font-serif text-sm text-gray-500">Recherche en cours...</p>
              ) : planningQuery.trim().length >= 2 ? (
                planningSearchResults.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-2">
                    {planningSearchResults.map((item) => (
                      <div key={makeMediaKey(item.id, item.type)} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-2">
                        <p className="font-serif text-sm text-gray-700 line-clamp-1">{item.title} ({MEDIA_LABELS[item.type] || item.type})</p>
                        <button
                          type="button"
                          onClick={() => handleAddRoadmapFromSearch(item)}
                          className="px-3 py-1 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs"
                        >
                          Ajouter
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-serif text-sm text-gray-500">Aucune fiche existante trouvee.</p>
                )
              ) : (
                <p className="font-serif text-sm text-gray-500">Tape au moins 2 caracteres pour rechercher.</p>
              )}
            </div>

            {roadmapCandidates.length > 0 ? (
              <div className="border border-gray-300 bg-gray-50 p-4 mb-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Options rapides (0 episode ou a reprendre)</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {roadmapCandidates.slice(0, 8).map((item) => (
                    <div key={makeMediaKey(item.id, item.type)} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-2">
                      <p className="font-serif text-sm text-gray-700 line-clamp-1">{item.title}</p>
                      <button
                        type="button"
                        onClick={() => handleAddRoadmapFromCandidate(item)}
                        className="px-3 py-1 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs"
                      >
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mb-4">
              {roadmapFilters.map((filterValue) => (
                <button
                  key={filterValue}
                  type="button"
                  onClick={() => setRoadmapFilter(filterValue)}
                  className={`px-3 py-2 border font-display uppercase tracking-wider text-xs ${roadmapFilter === filterValue ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  {filterValue === 'all'
                    ? `Tout (${roadmapItems.length})`
                    : `${MEDIA_LABELS[filterValue] || filterValue} (${roadmapTypeCounts[filterValue] || 0})`}
                </button>
              ))}
            </div>

            {filteredRoadmapItems.length > 0 ? (
              <div className="overflow-x-auto pb-2">
                <div className="flex items-stretch gap-3 min-w-max">
                  {filteredRoadmapItems.slice(0, 20).map((item, index) => {
                    const posterUrl = getRoadmapPosterUrl(item);
                    const detailPath = getRoadmapPath(item);
                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        <div
                          draggable
                          onDragStart={() => setDraggedRoadmapId(item.id)}
                          onDragEnd={() => setDraggedRoadmapId('')}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleRoadmapDrop(item.id)}
                          className={`w-44 block border bg-gray-50 transition-colors ${draggedRoadmapId === item.id ? 'border-gray-700 opacity-60' : 'border-gray-300'}`}
                        >
                          {detailPath ? (
                            <Link to={detailPath} className="block hover:bg-gray-100 transition-colors">
                              <div className="aspect-2/3 bg-gray-200 border-b border-gray-300 overflow-hidden">
                                {posterUrl ? (
                                  <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 font-display text-xs uppercase tracking-wider px-2 text-center">
                                    Affiche indisponible
                                  </div>
                                )}
                              </div>
                              <div className="p-3">
                                <p className="font-display text-xs uppercase tracking-wider text-gray-500 mb-1">Etape {index + 1}</p>
                                <p className="font-serif text-sm text-gray-700 line-clamp-2">{item.title}</p>
                                <p className="font-serif text-sm text-gray-700">{MEDIA_LABELS[item.type] || item.type}</p>
                              </div>
                            </Link>
                          ) : (
                            <div className="block">
                              <div className="aspect-2/3 bg-gray-200 border-b border-gray-300 overflow-hidden">
                                {posterUrl ? (
                                  <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 font-display text-xs uppercase tracking-wider px-2 text-center">
                                    Affiche indisponible
                                  </div>
                                )}
                              </div>
                              <div className="p-3">
                                <p className="font-display text-xs uppercase tracking-wider text-gray-500 mb-1">Etape {index + 1}</p>
                                <p className="font-serif text-sm text-gray-700 line-clamp-2">{item.title}</p>
                                <p className="font-serif text-sm text-gray-700">{MEDIA_LABELS[item.type] || item.type}</p>
                              </div>
                            </div>
                          )}
                          <div className="px-3 pb-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveRoadmap(item.id, 'up')}
                              className="px-2 py-1 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-[10px]"
                            >
                              Monter
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRoadmap(item.id, 'down')}
                              className="px-2 py-1 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-[10px]"
                            >
                              Descendre
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRoadmap(item.id)}
                              className="px-2 py-1 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-[10px]"
                            >
                              Retirer
                            </button>
                          </div>
                        </div>
                        {index < filteredRoadmapItems.length - 1 ? (
                          <span className="font-display text-lg text-gray-500">-&gt;</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="font-serif text-sm text-gray-500">Aucun element futur dans cette categorie.</p>
            )}

            <div className="mt-6 border border-gray-300 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">5 recommandations ciblees selon tes vrais gouts (types preferes + historiques + similarite de titres/genres)</p>
              {loadingRecommendations ? (
                <p className="font-serif text-sm text-gray-500">Calcul des recommandations...</p>
              ) : recommendedItems.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {recommendedItems.map((item, index) => {
                    const posterUrl = getRoadmapPosterUrl(item);
                    const detailPath = getRoadmapPath(item);
                    return (
                      <Link key={item.key} to={detailPath || '/'} className="block border border-gray-300 bg-white hover:bg-gray-100 transition-colors">
                        <div className="aspect-2/3 bg-gray-200 border-b border-gray-300 overflow-hidden">
                          {posterUrl ? (
                            <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-display text-xs uppercase tracking-wider px-2 text-center">
                              Affiche indisponible
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="font-display text-[10px] uppercase tracking-wider text-gray-500 mb-1">Suggestion {index + 1}</p>
                          <p className="font-serif text-xs text-gray-700 line-clamp-2">{item.title}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="font-serif text-sm text-gray-500">Pas assez de signaux pour proposer 5 idees pour l instant.</p>
              )}
            </div>
          </section>
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n etes pas connecte.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour gerer votre planning.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm">
                Connexion
              </Link>
              <Link to="/register" className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100">
                Inscription
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default Planning;
