import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tmdbService } from '../services/tmdb';
import { useLibrary } from '../hooks/useLocalStorage';
import MediaCard from '../components/MediaCard';
import { useTopPicks } from '../hooks/useLocalStorage';

const STATUS_LABELS = {
  to_start: 'A commencer',
  in_progress: 'En cours',
  to_resume: 'A reprendre',
  done: 'Termine',
};

const TYPE_LABELS = {
  movie: 'Film',
  series: 'Serie',
  anime: 'Anime',
  manga: 'Manga',
  manwha: 'Manwha',
  light_novel: 'Light Novel',
  roman: 'Roman',
};

const getSeasonPosition = (progressCurrent, seasonBreakdown = []) => {
  if (!Number.isFinite(progressCurrent) || progressCurrent <= 0 || !Array.isArray(seasonBreakdown) || seasonBreakdown.length === 0) {
    return null;
  }

  let remaining = progressCurrent;
  for (const season of seasonBreakdown) {
    const count = Number(season.episodeCount || 0);
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }

    if (remaining <= count) {
      return {
        seasonNumber: season.seasonNumber,
        episodeInSeason: remaining,
      };
    }

    remaining -= count;
  }

  return null;
};

function Library() {
  const { getLibrary, removeFromLibrary, updateLibraryItem, refreshLibraryMetadata } = useLibrary();
  const { getTopPicks, removeFromTopPicks, moveTopPick, refreshTopPickTypes } = useTopPicks();
  const [items, setItems] = useState([]);
  const [topPicks, setTopPicks] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const initialLibrary = getLibrary();
    setItems(initialLibrary);
    setTopPicks(getTopPicks());

    let cancelled = false;

    Promise.all([refreshLibraryMetadata(), refreshTopPickTypes()]).then(([updatedItems, updatedTopPicks]) => {
      if (!cancelled) {
        setItems(updatedItems);
        setTopPicks(updatedTopPicks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const typeOk = filterType === 'all' ? true : item.type === filterType;
      const statusOk = filterStatus === 'all' ? true : item.status === filterStatus;
      const title = String(item.title || '').toLowerCase();
      const queryOk = normalizedQuery ? title.includes(normalizedQuery) : true;
      return typeOk && statusOk && queryOk;
    });
  }, [items, filterStatus, filterType, searchQuery]);

  const handleRemove = (item) => {
    const updated = removeFromLibrary(item.id, item.type);
    setItems(updated);
  };

  const handleStatusChange = (item, status) => {
    const updated = updateLibraryItem(item.id, item.type, { status });
    setItems(updated);
  };

  const handleProgressChange = (item, progressCurrent) => {
    const safeValue = Number.isFinite(progressCurrent) ? Math.max(0, progressCurrent) : 0;
    const maxProgress = Number.isFinite(item.progressTotal) && item.progressTotal > 0 ? item.progressTotal : null;
    const clampedValue = maxProgress ? Math.min(safeValue, maxProgress) : safeValue;
    const nextPatch = { progressCurrent: safeValue };

    // Saisir une progression fait passer automatiquement l'item en cours,
    // sauf si l'utilisateur l'a deja marque comme termine.
    if (clampedValue > 0 && item.status !== 'done') {
      nextPatch.status = 'in_progress';
    }

    nextPatch.progressCurrent = clampedValue;

    const updated = updateLibraryItem(item.id, item.type, nextPatch);
    setItems(updated);
  };

  const mediaTypes = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.type)));
    return unique;
  }, [items]);

  const handleTopPickRemove = (id, type) => {
    const updated = removeFromTopPicks(id, type);
    setTopPicks(updated);
  };

  const handleTopPickMove = (id, type, direction) => {
    const updated = moveTopPick(id, type, direction);
    setTopPicks(updated);
  };

  const groupedTopPicks = useMemo(() => {
    const grouped = topPicks.reduce((acc, item) => {
      const key = item.type || 'autre';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).sort((a, b) => {
      const labelA = TYPE_LABELS[a[0]] || a[0];
      const labelB = TYPE_LABELS[b[0]] || b[0];
      return labelA.localeCompare(labelB, 'fr');
    });
  }, [topPicks]);

  if (items.length === 0 && topPicks.length === 0) {
    return (
      <div className="vintage-frame">
        <div className="vintage-frame-top"></div>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-12 md:py-20 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
            Ma Bibliotheque
          </h1>
          <div className="border-2 border-gray-300 p-6 md:p-12 bg-white">
            <p className="font-serif text-xl text-gray-600 mb-4">
              Votre bibliotheque est vide.
            </p>
            <p className="font-serif text-gray-500">
              Ouvrez une fiche film, serie, anime ou lecture puis ajoutez-la a votre suivi.
            </p>
          </div>
        </div>
        <div className="vintage-frame-bottom"></div>
      </div>
    );
  }

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
        {topPicks.length > 0 && (
          <section className="mb-10 md:mb-12">
            <header className="mb-5">
              <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-gray-600 mb-2">
                Mes Tops
              </h2>
              <p className="font-serif text-gray-600">Vos classements personnels par categorie (top films, top anime, top manga, etc.).</p>
            </header>

            <div className="space-y-8">
              {groupedTopPicks.map(([type, list]) => (
                <div key={`top-${type}`}>
                  <h3 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-3">
                    Top {TYPE_LABELS[type] || type}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
                    {list.map((item, index) => (
                      <div key={`${type}-${item.id}`} className="relative group">
                        <MediaCard item={item} type={item.type} />
                        <span className="absolute top-2 left-2 bg-black text-white px-2 py-1 text-xs font-display uppercase border border-white">
                          #{index + 1}
                        </span>
                        <button
                          onClick={() => handleTopPickRemove(item.id, item.type)}
                          className="absolute top-2 right-2 bg-black text-white px-3 py-1 text-sm font-display uppercase opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity border border-white"
                        >
                          Retirer
                        </button>
                        <div className="absolute bottom-2 right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleTopPickMove(item.id, item.type, 'up')}
                            className="bg-black text-white px-2 py-1 text-xs font-display uppercase border border-white"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleTopPickMove(item.id, item.type, 'down')}
                            className="bg-black text-white px-2 py-1 text-xs font-display uppercase border border-white"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <header className="mb-8 md:mb-10">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-3">
            Ma Bibliotheque
          </h1>
          <p className="font-serif text-gray-600">{filteredItems.length} / {items.length} element(s) affiches</p>
        </header>

        <section className="mb-6 grid md:grid-cols-3 gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher un titre dans votre bibliotheque..."
            className="px-3 py-2 border-2 border-gray-400 bg-white font-serif text-sm text-gray-700"
          />

          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="px-3 py-2 border-2 border-gray-400 bg-white font-serif text-sm text-gray-700"
          >
            <option value="all">Tous les types</option>
            {mediaTypes.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type] || type}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="px-3 py-2 border-2 border-gray-400 bg-white font-serif text-sm text-gray-700"
          >
            <option value="all">Tous les statuts</option>
            <option value="to_start">A commencer</option>
            <option value="in_progress">En cours</option>
            <option value="to_resume">A reprendre</option>
            <option value="done">Termine</option>
          </select>
        </section>

        {filteredItems.length === 0 ? (
          <div className="border-2 border-gray-300 bg-white p-8 text-center">
            <p className="font-display uppercase tracking-wider text-gray-700">Aucun resultat dans la bibliotheque</p>
            <p className="font-serif text-sm text-gray-500 mt-2">Essayez un autre mot-cle ou ajustez les filtres.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const posterUrl = item.poster_path ? tmdbService.getImageUrl(item.poster_path, 'w342') : item.image;
            const detailPath = item.detailPath || '#';

            return (
              <article key={`${item.type}-${item.id}`} className="border-2 border-gray-300 bg-white p-4">
                <div className="flex gap-4">
                  <Link to={detailPath} className="shrink-0">
                    {posterUrl ? (
                      <img src={posterUrl} alt={item.title} className="w-20 h-28 object-cover border-2 border-gray-800" />
                    ) : (
                      <div className="w-20 h-28 bg-gray-900 border-2 border-gray-800 flex items-center justify-center text-gray-500 font-display">?</div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link to={detailPath} className="block">
                      <h2 className="font-display text-lg uppercase tracking-wider text-gray-700 line-clamp-2">{item.title}</h2>
                    </Link>
                    <p className="font-serif text-xs text-gray-500 mt-1">
                      {(TYPE_LABELS[item.type] || item.type)}{item.year ? ` • ${item.year}` : ''}
                    </p>

                    <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2">
                      <select
                        value={item.status}
                        onChange={(event) => handleStatusChange(item, event.target.value)}
                        className="px-2 py-1 border border-gray-400 bg-white font-serif text-xs text-gray-700"
                      >
                        <option value="to_start">A commencer</option>
                        <option value="in_progress">En cours</option>
                        <option value="to_resume">A reprendre</option>
                        <option value="done">Termine</option>
                      </select>

                      <button
                        onClick={() => handleRemove(item)}
                        className="px-3 py-1 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs"
                      >
                        Retirer
                      </button>
                    </div>

                    {item.type === 'movie' ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="font-serif text-xs text-gray-500">Film: pas de progression chiffrée</span>
                        <span className="ml-auto text-[11px] font-display uppercase tracking-wider text-gray-500">
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <label className="font-serif text-xs text-gray-600">Progression</label>
                          <input
                            type="number"
                            min="0"
                            max={Number.isFinite(item.progressTotal) && item.progressTotal > 0 ? item.progressTotal : undefined}
                            value={item.progressCurrent || 0}
                            onChange={(event) => handleProgressChange(item, Number(event.target.value))}
                            className="w-20 px-2 py-1 border border-gray-400 text-xs font-serif"
                          />
                          <span className="font-serif text-xs text-gray-500">
                            / {item.progressTotal || '?'} {item.progressUnit || 'element'}
                          </span>
                          <span className="ml-auto text-[11px] font-display uppercase tracking-wider text-gray-500">
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                        </div>

                        {(item.type === 'series' || item.type === 'anime') && item.progressCurrent > 0 && (
                          <p className="mt-2 text-xs font-serif text-gray-600">
                            {(() => {
                              const seasonPosition = getSeasonPosition(item.progressCurrent, item.seasonBreakdown);
                              if (!seasonPosition) {
                                return 'Saison: information indisponible';
                              }

                              return `Saison ${seasonPosition.seasonNumber}, Episode ${seasonPosition.episodeInSeason}`;
                            })()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        )}
      </div>

      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default Library;
