import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUiPreferences } from '../context/UiPreferencesContext';
import { useLibrary, useRoadmap, useTopPicks } from '../hooks/useLocalStorage';
import { authApi } from '../services/authApi';
import { tmdbService } from '../services/tmdb';
import { readingApi } from '../services/readingApi';
import { computeProfileStats, formatMinutes } from '../utils/profileStats';

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
  return {
    id: String(item?.id || item?.mal_id || item?.workKey || ''),
    type: item?.type || fallbackType,
    title: item?.title || item?.name || 'Titre indisponible',
    posterPath: item?.poster_path || null,
    image: item?.image || null,
    voteAverage: Number(item?.vote_average || item?.score || 0),
    popularity: Number(item?.popularity || 0),
  };
}

function getRoadmapPosterUrl(item) {
  const tmdbPosterPath = item?.poster_path || item?.posterPath;
  if (tmdbPosterPath) {
    return tmdbService.getImageUrl(tmdbPosterPath, 'w342');
  }
  return item?.image || null;
}

function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, setUser } = useAuth();
  const { preferences, updatePreferences } = useUiPreferences();
  const { getLibrary, refreshLibraryMetadata } = useLibrary();
  const { getRoadmap, addRoadmapItem, addManualRoadmapItem, removeRoadmapItem, moveRoadmapItem } = useRoadmap();
  const { getTopPicks, refreshTopPickTypes } = useTopPicks();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [stats, setStats] = useState(() => computeProfileStats([], []));
  const [loadingStats, setLoadingStats] = useState(false);
  const [friendsData, setFriendsData] = useState({ friends: [], incomingRequests: [], outgoingRequests: [] });
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [friendActionId, setFriendActionId] = useState('');
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [roadmapCandidates, setRoadmapCandidates] = useState([]);
  const [manualRoadmapTitle, setManualRoadmapTitle] = useState('');
  const [manualRoadmapType, setManualRoadmapType] = useState('movie');
  const [manualRoadmapDate, setManualRoadmapDate] = useState('');
  const [roadmapFilter, setRoadmapFilter] = useState('all');
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
  }, [user?.displayName]);

  useEffect(() => {
    let cancelled = false;

    const topPicks = getTopPicks();
    const library = getLibrary();
    setStats(computeProfileStats(library, topPicks));
    setRoadmapItems(
      getRoadmap()
        .sort((left, right) => {
          const leftDate = left?.plannedFor || '9999-12-31';
          const rightDate = right?.plannedFor || '9999-12-31';
          const byDate = leftDate.localeCompare(rightDate);
          if (byDate !== 0) {
            return byDate;
          }
          return Number(left?.order || 0) - Number(right?.order || 0);
        }),
    );
    setRoadmapCandidates(
      library
        .filter((item) => item && (item?.progressCurrent === 0 || String(item?.status || '').toLowerCase() === 'to_resume'))
        .slice(0, 16),
    );

    if (!isAuthenticated) {
      return () => {
        cancelled = true;
      };
    }

    setLoadingStats(true);
    Promise.all([refreshLibraryMetadata(), refreshTopPickTypes()])
      .then(([updatedLibrary, updatedTopPicks]) => {
        if (!cancelled) {
          setStats(computeProfileStats(updatedLibrary, updatedTopPicks));
          setRoadmapItems(
            getRoadmap()
              .sort((left, right) => {
                const leftDate = left?.plannedFor || '9999-12-31';
                const rightDate = right?.plannedFor || '9999-12-31';
                const byDate = leftDate.localeCompare(rightDate);
                if (byDate !== 0) {
                  return byDate;
                }
                return Number(left?.order || 0) - Number(right?.order || 0);
              }),
          );
          setRoadmapCandidates(
            updatedLibrary
              .filter((item) => item && (item?.progressCurrent === 0 || String(item?.status || '').toLowerCase() === 'to_resume'))
              .slice(0, 16),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStats(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const loadFriends = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoadingFriends(true);
      const data = await authApi.getFriends();
      setFriendsData({
        friends: Array.isArray(data.friends) ? data.friends : [],
        incomingRequests: Array.isArray(data.incomingRequests) ? data.incomingRequests : [],
        outgoingRequests: Array.isArray(data.outgoingRequests) ? data.outgoingRequests : [],
      });
    } catch (err) {
      setError(err.message || 'Impossible de charger les amis.');
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setFriendsData({ friends: [], incomingRequests: [], outgoingRequests: [] });
      return;
    }

    loadFriends();
  }, [isAuthenticated, user?.id]);

  const statCards = useMemo(
    () => [
      { label: 'Temps regarde', value: formatMinutes(stats.watchedMinutes) },
      { label: 'Elements suivis', value: stats.trackedItems },
      { label: 'Termines', value: stats.completedItems },
      { label: 'Top personnels', value: stats.topPicksCount },
    ],
    [stats],
  );

  const mediaBreakdown = useMemo(
    () => Object.entries(stats.mediaCounts).filter(([, count]) => count > 0),
    [stats.mediaCounts],
  );

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
        const blocked = new Set(
          [
            ...library.map((entry) => makeMediaKey(entry.id, entry.type)),
            ...roadmap.map((entry) => toRoadmapSourceKey(entry)).filter(Boolean),
          ],
        );

        const tmdbSeeds = [];
        topPicks
          .filter((entry) => ['movie', 'series', 'anime'].includes(entry?.type))
          .slice(0, 4)
          .forEach((entry) => tmdbSeeds.push({
            id: entry.id,
            type: entry.type === 'movie' ? 'movie' : 'series',
            weight: 140,
          }));

        library
          .filter((entry) => entry?.status === 'done' && ['movie', 'series', 'anime'].includes(entry?.type))
          .slice(0, 4)
          .forEach((entry) => tmdbSeeds.push({
            id: entry.id,
            type: entry.type === 'movie' ? 'movie' : 'series',
            weight: 100,
          }));

        roadmap
          .filter((entry) => ['movie', 'series', 'anime'].includes(entry?.type) && entry?.refId)
          .slice(0, 3)
          .forEach((entry) => tmdbSeeds.push({
            id: entry.refId,
            type: entry.type === 'movie' ? 'movie' : 'series',
            weight: 80,
          }));

        const candidates = [];

        const seedResults = await Promise.allSettled(
          tmdbSeeds.map(async (seed) => {
            const details = seed.type === 'movie'
              ? await tmdbService.getMovieDetails(seed.id)
              : await tmdbService.getSeriesDetails(seed.id);
            const similar = Array.isArray(details?.similar?.results) ? details.similar.results : [];
            return { seed, similar };
          }),
        );

        seedResults.forEach((result) => {
          if (result.status !== 'fulfilled') {
            return;
          }

          const { seed, similar } = result.value;
          similar.slice(0, 10).forEach((entry) => {
            const normalized = normalizeRecommendationItem(entry, seed.type === 'movie' ? 'movie' : 'series');
            const key = makeMediaKey(normalized.id, normalized.type);
            if (!normalized.id || blocked.has(key)) {
              return;
            }

            candidates.push({
              ...normalized,
              key,
              score: seed.weight + normalized.voteAverage * 12 + Math.min(normalized.popularity, 100),
            });
          });
        });

        const [moviesRes, seriesRes, animeRes, mangaRes, manwhaRes, lightRes, romanRes] = await Promise.allSettled([
          tmdbService.getTrendingMovies('week'),
          tmdbService.getTrendingSeries('week'),
          tmdbService.getAnime(1, 'popularity'),
          readingApi.getMangas(1),
          readingApi.getManwha(1),
          readingApi.getLightNovels(1),
          readingApi.getRomans(1),
        ]);

        const fallbackBuckets = [
          { result: moviesRes, type: 'movie', weight: 25 },
          { result: seriesRes, type: 'series', weight: 25 },
          { result: animeRes, type: 'anime', weight: 30 },
          { result: mangaRes, type: 'manga', weight: 20 },
          { result: manwhaRes, type: 'manwha', weight: 20 },
          { result: lightRes, type: 'light_novel', weight: 20 },
          { result: romanRes, type: 'roman', weight: 20 },
        ];

        fallbackBuckets.forEach(({ result, type, weight }) => {
          if (result.status !== 'fulfilled') {
            return;
          }

          const items = Array.isArray(result.value?.results) ? result.value.results : [];
          items.slice(0, 10).forEach((entry) => {
            const normalized = normalizeRecommendationItem(entry, type);
            const key = makeMediaKey(normalized.id, normalized.type);
            if (!normalized.id || blocked.has(key)) {
              return;
            }

            candidates.push({
              ...normalized,
              key,
              score: weight + normalized.voteAverage * 8 + Math.min(normalized.popularity, 100),
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
      } catch (_error) {
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUpdateDisplayName = async (event) => {
    event.preventDefault();
    const nextDisplayName = String(displayName || '').trim();

    if (!nextDisplayName) {
      setError('Le pseudo est requis.');
      setSuccessMessage('');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');
      const data = await authApi.updateDisplayName(nextDisplayName);
      setUser(data.user);
      setDisplayName(data.user?.displayName || nextDisplayName);
      setSuccessMessage('Pseudo mis a jour.');
    } catch (err) {
      setError(err.message || 'Impossible de mettre a jour le pseudo.');
    } finally {
      setSaving(false);
    }
  };

  const handleCardColorToggle = () => {
    updatePreferences({ showCardColors: !preferences.showCardColors });
    setSuccessMessage(!preferences.showCardColors ? 'Affichage colore active.' : 'Affichage vintage par defaut restaure.');
    setError('');
  };

  const handleFriendSearch = async (event) => {
    event.preventDefault();
    if (!friendQuery.trim()) {
      setFriendSearchResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      setError('');
      const data = await authApi.searchUsers(friendQuery.trim());
      setFriendSearchResults(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err.message || 'Impossible de rechercher des utilisateurs.');
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleSendFriendRequest = async (targetUserId) => {
    try {
      setFriendActionId(`send-${targetUserId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.sendFriendRequest(targetUserId);
      setSuccessMessage(data.message || 'Demande envoyee.');
      await loadFriends();
      if (friendQuery.trim()) {
        const refreshed = await authApi.searchUsers(friendQuery.trim());
        setFriendSearchResults(Array.isArray(refreshed.users) ? refreshed.users : []);
      }
    } catch (err) {
      setError(err.message || 'Impossible d envoyer la demande.');
    } finally {
      setFriendActionId('');
    }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      setFriendActionId(`accept-${requestId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.acceptFriendRequest(requestId);
      setSuccessMessage(data.message || 'Demande acceptee.');
      await loadFriends();
      if (friendQuery.trim()) {
        const refreshed = await authApi.searchUsers(friendQuery.trim());
        setFriendSearchResults(Array.isArray(refreshed.users) ? refreshed.users : []);
      }
    } catch (err) {
      setError(err.message || 'Impossible d accepter cette demande.');
    } finally {
      setFriendActionId('');
    }
  };

  const handleRemoveFriend = async (targetUserId) => {
    try {
      setFriendActionId(`remove-${targetUserId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.removeFriend(targetUserId);
      setSuccessMessage(data.message || 'Relation supprimee.');
      await loadFriends();
      if (friendQuery.trim()) {
        const refreshed = await authApi.searchUsers(friendQuery.trim());
        setFriendSearchResults(Array.isArray(refreshed.users) ? refreshed.users : []);
      }
    } catch (err) {
      setError(err.message || 'Impossible de supprimer cette relation.');
    } finally {
      setFriendActionId('');
    }
  };

  const refreshRoadmapState = () => {
    const sorted = getRoadmap().sort((left, right) => {
      const leftDate = left?.plannedFor || '9999-12-31';
      const rightDate = right?.plannedFor || '9999-12-31';
      const byDate = leftDate.localeCompare(rightDate);
      if (byDate !== 0) {
        return byDate;
      }
      return Number(left?.order || 0) - Number(right?.order || 0);
    });
    setRoadmapItems(sorted);
  };

  const handleAddRoadmapFromCandidate = (item) => {
    addRoadmapItem(item, item?.type || 'movie', null);
    refreshRoadmapState();
  };

  const handleAddManualRoadmap = (event) => {
    event.preventDefault();
    addManualRoadmapItem({
      title: manualRoadmapTitle,
      type: manualRoadmapType,
      plannedFor: manualRoadmapDate || null,
    });
    setManualRoadmapTitle('');
    setManualRoadmapDate('');
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

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
          Mon profil
        </h1>

        {isAuthenticated ? (
          <div className="space-y-6">
            <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-2">Compte connecté</p>
            <p className="text-2xl md:text-3xl font-display uppercase tracking-wider text-gray-700 mb-2">
              {user?.displayName || 'Utilisateur'}
            </p>
            <p className="font-serif text-gray-600 mb-6">{user?.email}</p>

            <form onSubmit={handleUpdateDisplayName} className="mb-8 border border-gray-300 bg-gray-50 p-4">
              <label htmlFor="displayName" className="block text-xs uppercase tracking-wider text-gray-500 font-display mb-2">
                Modifier mon pseudo
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nouveau pseudo"
                  className="flex-1 px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                  minLength={2}
                  maxLength={50}
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm disabled:opacity-60"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
              {error ? <p className="text-sm text-red-700 font-serif mt-2">{error}</p> : null}
              {successMessage ? <p className="text-sm text-green-700 font-serif mt-2">{successMessage}</p> : null}
            </form>

            <div className="flex flex-wrap gap-3">
              <Link to="/library" className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm">
                Ma bibliothèque
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100"
              >
                Déconnexion
              </button>
            </div>

              <div className="mt-8 border border-gray-300 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Affichage des cartes</p>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="font-display uppercase tracking-wider text-sm text-gray-700">Cartes directement en couleur</p>
                    <p className="font-serif text-sm text-gray-500">Active les posters colores sans attendre le survol.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCardColorToggle}
                    className={`px-4 py-2 border font-display uppercase tracking-wider text-xs ${preferences.showCardColors ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-400'}`}
                  >
                    {preferences.showCardColors ? 'Active' : 'Inactive'}
                  </button>
                </label>
              </div>
            </div>

            <section className="border-2 border-gray-300 bg-white p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-1">Statistiques</p>
                  <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700">Mon activite</h2>
                </div>
                {loadingStats ? <span className="font-serif text-sm text-gray-500">Mise a jour des donnees...</span> : null}
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                {statCards.map((stat) => (
                  <div key={stat.label} className="border border-gray-300 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">{stat.label}</p>
                    <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {mediaBreakdown.map(([type, count]) => (
                  <div key={type} className="border border-gray-300 bg-white p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">{MEDIA_LABELS[type] || type}</p>
                    <p className="text-xl font-display uppercase tracking-wider text-gray-800">{count}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-2 border-gray-300 bg-white p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-1">Roadmap</p>
                  <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700">Planning chronologique a voir / lire</h2>
                </div>
                <span className="font-serif text-sm text-gray-500">{roadmapItems.length} element(s)</span>
              </div>

              <form onSubmit={handleAddManualRoadmap} className="border border-gray-300 bg-gray-50 p-4 mb-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Ajouter manuellement a la roadmap</p>
                <div className="grid md:grid-cols-[1fr_150px_170px_auto] gap-2">
                  <input
                    type="text"
                    value={manualRoadmapTitle}
                    onChange={(event) => setManualRoadmapTitle(event.target.value)}
                    placeholder="Titre a planifier"
                    className="px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                  />
                  <select
                    value={manualRoadmapType}
                    onChange={(event) => setManualRoadmapType(event.target.value)}
                    className="px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                  >
                    <option value="movie">Film</option>
                    <option value="series">Serie</option>
                    <option value="anime">Anime</option>
                    <option value="manga">Manga</option>
                    <option value="manwha">Manwha</option>
                    <option value="light_novel">Light Novel</option>
                    <option value="roman">Roman</option>
                  </select>
                  <input
                    type="date"
                    value={manualRoadmapDate}
                    onChange={(event) => setManualRoadmapDate(event.target.value)}
                    className="px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs"
                  >
                    Ajouter
                  </button>
                </div>
              </form>

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {filteredRoadmapItems.slice(0, 20).map((item, index) => {
                    const posterUrl = getRoadmapPosterUrl(item);
                    const detailPath = getRoadmapPath(item);
                    return (
                      <div key={item.id} className="block border border-gray-300 bg-gray-50 transition-colors">
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
                              <p className="font-display text-xs uppercase tracking-wider text-gray-500 mb-1">{index + 1}. {item.title}</p>
                              <p className="font-serif text-sm text-gray-700">{MEDIA_LABELS[item.type] || item.type}</p>
                              <p className="font-serif text-xs text-gray-500 mt-1">
                                {item?.plannedFor ? `Prevu le ${new Date(item.plannedFor).toLocaleDateString('fr-FR')}` : 'Sans date'}
                              </p>
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
                              <p className="font-display text-xs uppercase tracking-wider text-gray-500 mb-1">{index + 1}. {item.title}</p>
                              <p className="font-serif text-sm text-gray-700">{MEDIA_LABELS[item.type] || item.type}</p>
                              <p className="font-serif text-xs text-gray-500 mt-1">
                                {item?.plannedFor ? `Prevu le ${new Date(item.plannedFor).toLocaleDateString('fr-FR')}` : 'Sans date'}
                              </p>
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
                    );
                  })}
                </div>
              ) : (
                <p className="font-serif text-sm text-gray-500">Aucun element futur dans cette categorie.</p>
              )}

              <div className="mt-6 border border-gray-300 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">5 recommandations plus pertinentes (tops + termines + similaires)</p>
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

            <section className="border-2 border-gray-300 bg-white p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-1">Amis</p>
                  <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700">Ajouter des gens du site</h2>
                </div>
                {loadingFriends ? <span className="font-serif text-sm text-gray-500">Chargement...</span> : null}
              </div>

              <form onSubmit={handleFriendSearch} className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                  type="search"
                  value={friendQuery}
                  onChange={(event) => setFriendQuery(event.target.value)}
                  placeholder="Rechercher un pseudo"
                  className="flex-1 px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                />
                <button
                  type="submit"
                  disabled={searchingUsers}
                  className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm disabled:opacity-60"
                >
                  {searchingUsers ? 'Recherche...' : 'Rechercher'}
                </button>
              </form>

              {friendSearchResults.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {friendSearchResults.map((person) => (
                    <div key={person.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-300 bg-gray-50 p-3">
                      <div>
                        <p className="font-display uppercase tracking-wider text-gray-700">{person.displayName}</p>
                        <Link to={`/profile/${person.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                      </div>
                      {person.relationStatus === 'friend' ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(person.id)}
                          disabled={friendActionId === `remove-${person.id}`}
                          className="px-4 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          {friendActionId === `remove-${person.id}` ? '...' : 'Retirer'}
                        </button>
                      ) : person.relationStatus === 'incoming_request' ? (
                        <button
                          type="button"
                          onClick={() => handleAcceptFriendRequest(person.friendshipId)}
                          disabled={friendActionId === `accept-${person.friendshipId}`}
                          className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          {friendActionId === `accept-${person.friendshipId}` ? '...' : 'Accepter'}
                        </button>
                      ) : person.relationStatus === 'outgoing_request' ? (
                        <span className="px-4 py-2 border border-gray-300 bg-white text-gray-500 font-display uppercase tracking-wider text-xs">Demande envoyee</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendFriendRequest(person.id)}
                          disabled={friendActionId === `send-${person.id}`}
                          className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          {friendActionId === `send-${person.id}` ? '...' : 'Ajouter'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="border border-gray-300 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Mes amis</p>
                  <div className="space-y-2">
                    {friendsData.friends.length ? friendsData.friends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-3">
                        <div>
                          <p className="font-display uppercase tracking-wider text-gray-700">{friend.displayName}</p>
                          <Link to={`/profile/${friend.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(friend.id)}
                          disabled={friendActionId === `remove-${friend.id}`}
                          className="px-3 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          {friendActionId === `remove-${friend.id}` ? '...' : 'Retirer'}
                        </button>
                      </div>
                    )) : <p className="font-serif text-sm text-gray-500">Aucun ami pour le moment.</p>}
                  </div>
                </div>

                <div className="border border-gray-300 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Demandes recues</p>
                  <div className="space-y-2">
                    {friendsData.incomingRequests.length ? friendsData.incomingRequests.map((request) => (
                      <div key={request.requestId} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-3">
                        <div>
                          <p className="font-display uppercase tracking-wider text-gray-700">{request.displayName}</p>
                          <Link to={`/profile/${request.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAcceptFriendRequest(request.requestId)}
                          disabled={friendActionId === `accept-${request.requestId}`}
                          className="px-3 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          {friendActionId === `accept-${request.requestId}` ? '...' : 'Accepter'}
                        </button>
                      </div>
                    )) : <p className="font-serif text-sm text-gray-500">Aucune demande en attente.</p>}
                  </div>
                </div>

                <div className="border border-gray-300 bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Demandes envoyees</p>
                  <div className="space-y-2">
                    {friendsData.outgoingRequests.length ? friendsData.outgoingRequests.map((request) => (
                      <div key={request.requestId} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-3">
                        <div>
                          <p className="font-display uppercase tracking-wider text-gray-700">{request.displayName}</p>
                          <Link to={`/profile/${request.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(request.id)}
                          disabled={friendActionId === `remove-${request.id}`}
                          className="px-3 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          {friendActionId === `remove-${request.id}` ? '...' : 'Annuler'}
                        </button>
                      </div>
                    )) : <p className="font-serif text-sm text-gray-500">Aucune demande envoyee.</p>}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n’êtes pas connecté.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour retrouver votre profil et gérer votre compte.</p>
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

export default Profile;