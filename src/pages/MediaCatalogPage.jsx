import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MediaCard from '../components/MediaCard';
import Pagination from '../components/Pagination';
import { tmdbService } from '../services/tmdb';

const SORT_OPTIONS = {
  popularity: 'Popularite',
  rating_desc: 'Note decroissante',
  rating_asc: 'Note croissante',
  alpha_asc: 'Alphabetique A-Z',
  alpha_desc: 'Alphabetique Z-A',
};

const CREDIT_ROLE_OPTIONS = {
  all: 'Acteur / realisateur / equipe',
  actor: 'Acteur',
  director: 'Realisateur',
  crew: 'Equipe',
};

function getTitle(item, mediaType) {
  return mediaType === 'movie' ? item.title || '' : item.name || '';
}

function normalizePersonName(value) {
  return String(value || '').trim().toLowerCase();
}

function itemMatchesCredit(item, creditFilter, creditRole) {
  const query = normalizePersonName(creditFilter);
  if (!query) {
    return true;
  }

  const creditData = item.creditData;
  if (!creditData) {
    return false;
  }

  const casts = Array.isArray(creditData.cast) ? creditData.cast : [];
  const crews = Array.isArray(creditData.crew) ? creditData.crew : [];
  const creators = Array.isArray(creditData.createdBy) ? creditData.createdBy : [];

  const matchActor = casts.some((person) => normalizePersonName(person.name).includes(query));
  const matchDirector = crews.some((person) => {
    const job = normalizePersonName(person.job);
    return job.includes('director') && normalizePersonName(person.name).includes(query);
  }) || creators.some((person) => normalizePersonName(person.name).includes(query));
  const matchCrew = crews.some((person) => normalizePersonName(person.name).includes(query)) || creators.some((person) => normalizePersonName(person.name).includes(query));

  if (creditRole === 'actor') {
    return matchActor;
  }

  if (creditRole === 'director') {
    return matchDirector;
  }

  if (creditRole === 'crew') {
    return matchCrew;
  }

  return matchActor || matchDirector || matchCrew;
}

function sortItems(items, mediaType, sortKey) {
  const nextItems = [...items];

  nextItems.sort((left, right) => {
    if (sortKey === 'rating_desc') {
      return (right.vote_average || 0) - (left.vote_average || 0);
    }

    if (sortKey === 'rating_asc') {
      return (left.vote_average || 0) - (right.vote_average || 0);
    }

    if (sortKey === 'alpha_asc') {
      return getTitle(left, mediaType).localeCompare(getTitle(right, mediaType), 'fr');
    }

    if (sortKey === 'alpha_desc') {
      return getTitle(right, mediaType).localeCompare(getTitle(left, mediaType), 'fr');
    }

    return (right.popularity || 0) - (left.popularity || 0);
  });

  return nextItems;
}

function MediaCatalogPage({ title, initialLetter, mediaType, loadPage }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [creditsMap, setCreditsMap] = useState({});

  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const sort = searchParams.get('sort') || 'popularity';
  const creditRole = searchParams.get('creditRole') || 'all';
  const creditFilter = searchParams.get('creditFilter') || '';

  const updateSearchParams = (patch) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(patch).forEach(([key, value]) => {
      const normalizedValue = value == null ? '' : String(value).trim();
      if (!normalizedValue || (key === 'page' && normalizedValue === '1') || (key === 'sort' && normalizedValue === 'popularity') || (key === 'creditRole' && normalizedValue === 'all')) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, normalizedValue);
      }
    });

    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchItems = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await loadPage(page);
        if (!cancelled) {
          setItems(Array.isArray(data.results) ? data.results : []);
          setTotalPages(Math.max(1, Math.min(data.total_pages || 1, 500)));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError('Impossible de charger cette page pour le moment.');
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchItems();
    window.scrollTo(0, 0);

    return () => {
      cancelled = true;
    };
  }, [loadPage, page]);

  useEffect(() => {
    const normalizedFilter = normalizePersonName(creditFilter);
    if (!normalizedFilter || items.length === 0) {
      return;
    }

    let cancelled = false;

    const fetchCredits = async () => {
      const missingItems = items.filter((item) => !creditsMap[item.id]);
      if (missingItems.length === 0) {
        return;
      }

      const results = await Promise.all(
        missingItems.map(async (item) => {
          try {
            const details = mediaType === 'movie'
              ? await tmdbService.getMovieDetails(item.id)
              : await tmdbService.getSeriesDetails(item.id);

            return [
              item.id,
              {
                cast: details?.credits?.cast || [],
                crew: details?.credits?.crew || [],
                createdBy: details?.created_by || [],
              },
            ];
          } catch (_error) {
            return [item.id, { cast: [], crew: [], createdBy: [] }];
          }
        }),
      );

      if (!cancelled) {
        setCreditsMap((current) => ({
          ...current,
          ...Object.fromEntries(results),
        }));
      }
    };

    fetchCredits();

    return () => {
      cancelled = true;
    };
  }, [creditFilter, creditsMap, items, mediaType]);

  const displayedItems = useMemo(() => {
    const enrichedItems = items.map((item) => ({
      ...item,
      creditData: creditsMap[item.id] || null,
    }));

    const filteredItems = enrichedItems.filter((item) => itemMatchesCredit(item, creditFilter, creditRole));
    return sortItems(filteredItems, mediaType, sort);
  }, [creditFilter, creditRole, creditsMap, items, mediaType, sort]);

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="px-3 sm:px-6 md:px-12 py-6 md:py-8">
        <header className="mb-8 md:mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-4">
            <span className="text-5xl sm:text-6xl md:text-7xl text-gray-800">{initialLetter}</span>{title.slice(1)}
          </h1>
          <div className="h-1 w-24 md:w-32 bg-gray-400"></div>
        </header>

        <section className="mb-6 grid lg:grid-cols-[1fr_220px_220px] gap-3">
          <input
            type="search"
            value={creditFilter}
            onChange={(event) => updateSearchParams({ creditFilter: event.target.value, page: 1 })}
            placeholder="Filtrer par acteur, realisateur, equipe..."
            className="px-4 py-2.5 border-2 border-gray-400 bg-white font-serif text-base text-gray-700"
          />

          <select
            value={creditRole}
            onChange={(event) => updateSearchParams({ creditRole: event.target.value, page: 1 })}
            className="px-4 py-2.5 border-2 border-gray-400 bg-white font-serif text-base text-gray-700"
          >
            {Object.entries(CREDIT_ROLE_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => updateSearchParams({ sort: event.target.value })}
            className="px-4 py-2.5 border-2 border-gray-400 bg-white font-serif text-base text-gray-700"
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </section>

        <p className="mb-4 font-serif text-base text-gray-600">
          URL pilotable: utilisez ?page=12, ?sort=rating_desc, ?creditFilter=nom, etc.
        </p>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="border-2 border-red-300 bg-red-50 p-8 text-center">
            <p className="font-display uppercase tracking-wider text-red-700">Erreur API</p>
            <p className="font-serif text-sm text-red-600 mt-2">{error}</p>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="border-2 border-gray-300 bg-white p-8 text-center">
            <p className="font-display uppercase tracking-wider text-gray-700">Aucun resultat avec ces filtres</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 mb-8 md:mb-12">
              {displayedItems.map((item) => (
                <MediaCard key={item.id} item={item} type={mediaType} />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => updateSearchParams({ page: nextPage })} />
          </>
        )}
      </div>

      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default MediaCatalogPage;