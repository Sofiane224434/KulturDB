import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import { tmdbService } from '../services/tmdb';
import { useLibrary } from '../hooks/useLocalStorage';

function normalizeDetailMediaType(value) {
  if (value === 'movie') {
    return 'movie';
  }

  if (value === 'series' || value === 'anime') {
    return 'series';
  }

  return value || 'series';
}

function getDetailLink(entry) {
  const mediaType = normalizeDetailMediaType(entry?.type);
  const id = entry?.id || entry?.itemId;
  if (!id) {
    return null;
  }

  if (mediaType === 'movie') {
    return `/movie/${id}`;
  }

  if (mediaType === 'series') {
    return `/series/${id}`;
  }

  return `/reading/${mediaType}/${id}`;
}

function getEntryKey(entry) {
  const mediaType = normalizeDetailMediaType(entry?.type);
  const id = entry?.id || entry?.itemId;
  return `${mediaType}:${String(id || '')}`;
}

function ActivityDetailCards({ entries, emptyLabel, metaLabel }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return <p className="font-serif text-sm text-gray-500">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {entries.map((entry, index) => {
        const title = entry?.title || 'Titre indisponible';
        const posterUrl = tmdbService.getImageUrl(entry?.posterPath, 'w342');
        const detailLink = getDetailLink(entry);

        const content = (
          <article className="border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="w-full aspect-2/3 bg-gray-200 border-b border-gray-300 overflow-hidden">
              {posterUrl ? (
                <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 font-display text-xs uppercase tracking-wider px-2 text-center">
                  Affiche indisponible
                </div>
              )}
            </div>

            <div className="p-3">
              <p className="font-display uppercase tracking-wider text-xs text-gray-500 mb-1">{index + 1}. {title}</p>
              <p className="font-serif text-sm text-gray-700">{metaLabel(entry)}</p>
            </div>
          </article>
        );

        if (!detailLink) {
          return <div key={`activity-card-${title}-${index}`}>{content}</div>;
        }

        return (
          <Link key={`activity-card-${detailLink}-${index}`} to={detailLink} className="block">
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { getLibrary } = useLibrary();
  const [profile, setProfile] = useState(null);
  const [publicActivity, setPublicActivity] = useState(null);
  const [activeDetail, setActiveDetail] = useState('topPicks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const watchTogetherSuggestions = useMemo(() => {
    if (!publicActivity) {
      return [];
    }

    const myLibrary = getLibrary();
    const myCompleted = myLibrary.filter((entry) => entry?.status === 'done');
    const myCompletedTypes = new Set(myCompleted.map((entry) => normalizeDetailMediaType(entry?.type)));
    const myCompletedKeys = new Set(myCompleted.map((entry) => getEntryKey(entry)));

    const theirCompleted = Array.isArray(publicActivity.details?.completed) ? publicActivity.details.completed : [];
    const theirCompletedTypes = new Set(theirCompleted.map((entry) => normalizeDetailMediaType(entry?.type)));
    const theirCompletedKeys = new Set(theirCompleted.map((entry) => getEntryKey(entry)));

    const sharedTypes = Array.from(myCompletedTypes).filter((type) => theirCompletedTypes.has(type));
    const allowedTypes = sharedTypes.length > 0 ? sharedTypes : ['movie', 'series'];

    const rawCandidates = [
      ...(Array.isArray(publicActivity.details?.roadmap) ? publicActivity.details.roadmap : []),
      ...(Array.isArray(publicActivity.recentTopPicks) ? publicActivity.recentTopPicks : []),
    ];

    const deduped = new Map();
    for (const entry of rawCandidates) {
      const key = getEntryKey(entry);
      const normalizedType = normalizeDetailMediaType(entry?.type);
      if (!entry?.id || !allowedTypes.includes(normalizedType)) {
        continue;
      }
      if (myCompletedKeys.has(key) || theirCompletedKeys.has(key)) {
        continue;
      }
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      }
    }

    return Array.from(deduped.values()).slice(0, 8);
  }, [publicActivity, getLibrary]);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await authApi.getUserProfile(userId);
        if (!cancelled) {
          setProfile(data.user || null);
          setPublicActivity(data.publicActivity || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossible de charger ce profil.');
          setProfile(null);
          setPublicActivity(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  if (!isAuthenticated) {
    return (
      <div className="vintage-frame">
        <div className="vintage-frame-top"></div>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
            Profil utilisateur
          </h1>
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-lg text-gray-700 mb-4">Connecte-toi pour voir le profil des autres utilisateurs.</p>
            <Link to="/login" className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm">
              Connexion
            </Link>
          </div>
        </div>
        <div className="vintage-frame-bottom"></div>
      </div>
    );
  }

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20 space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-sm hover:bg-gray-100"
        >
          Retour
        </button>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600">
          Profil utilisateur
        </h1>

        {loading ? (
          <div className="border-2 border-gray-300 bg-white p-8">
            <p className="font-serif text-gray-600">Chargement du profil...</p>
          </div>
        ) : error ? (
          <div className="border-2 border-red-300 bg-red-50 p-8">
            <p className="font-display uppercase tracking-wider text-red-700">Erreur</p>
            <p className="font-serif text-red-700 mt-2">{error}</p>
          </div>
        ) : profile ? (
          <>
            <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
              <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-2">Utilisateur</p>
              <p className="text-3xl md:text-4xl font-display uppercase tracking-wider text-gray-700 mb-2">{profile.displayName}</p>
              <p className="font-serif text-gray-600">Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR')}</p>
            </section>

            <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
              <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700 mb-3">Activite publique</h2>
              {publicActivity ? (
                <>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setActiveDetail('topPicks')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'topPicks' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Top personnels</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.topPicks || 0}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetail('tracked')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'tracked' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Elements suivis</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.tracked || 0}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetail('completed')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'completed' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Termines</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.completed || 0}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetail('roadmap')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'roadmap' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Roadmap</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.roadmap || 0}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetail('ratings')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'ratings' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Notes</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.ratings || 0}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetail('ratingsAverage')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'ratingsAverage' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Moyenne notes</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">
                        {publicActivity.ratingsAverage != null ? publicActivity.ratingsAverage : '-'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetail('comments')}
                      className={`border p-4 text-left transition-colors ${activeDetail === 'comments' ? 'border-gray-700 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Commentaires</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.comments || 0}</p>
                    </button>
                  </div>

                  <div className="border border-gray-300 bg-white p-4 mt-4">
                    {activeDetail === 'topPicks' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail top personnels</p>
                        <ActivityDetailCards
                          entries={publicActivity.recentTopPicks}
                          emptyLabel="Aucun top personnel visible."
                          metaLabel={(entry) => String(entry?.type || 'media').toUpperCase()}
                        />
                      </>
                    )}

                    {activeDetail === 'tracked' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail elements suivis</p>
                        <ActivityDetailCards
                          entries={publicActivity.details?.tracked}
                          emptyLabel="Aucun element suivi."
                          metaLabel={(entry) => `${entry?.progressCurrent || 0}/${entry?.progressTotal || '?'} ${entry?.progressUnit || 'element'}`}
                        />
                      </>
                    )}

                    {activeDetail === 'completed' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail termines</p>
                        <ActivityDetailCards
                          entries={publicActivity.details?.completed}
                          emptyLabel="Aucun element termine."
                          metaLabel={(entry) => `Type: ${String(entry?.type || 'media').toUpperCase()}`}
                        />
                      </>
                    )}

                    {activeDetail === 'roadmap' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail roadmap</p>
                        <ActivityDetailCards
                          entries={publicActivity.details?.roadmap}
                          emptyLabel="Aucun element futur partage."
                          metaLabel={(entry) => `${entry?.progressCurrent || 0}/${entry?.progressTotal || '?'} ${entry?.progressUnit || 'element'}`}
                        />
                      </>
                    )}

                    {activeDetail === 'ratings' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail notes</p>
                        <ActivityDetailCards
                          entries={publicActivity.details?.ratings}
                          emptyLabel="Aucune note."
                          metaLabel={(entry) => `Note: ${entry?.value || 0}/5`}
                        />
                      </>
                    )}

                    {activeDetail === 'ratingsAverage' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail moyenne notes</p>
                        <p className="font-serif text-sm text-gray-700">
                          Moyenne calculee sur {publicActivity.counts?.ratings || 0} note(s): {publicActivity.ratingsAverage != null ? `${publicActivity.ratingsAverage}/5` : 'Aucune moyenne disponible'}.
                        </p>
                      </>
                    )}

                    {activeDetail === 'comments' && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Detail commentaires</p>
                        <ActivityDetailCards
                          entries={publicActivity.details?.comments}
                          emptyLabel="Aucun commentaire."
                          metaLabel={(entry) => `${entry?.count || 0} commentaire(s)`}
                        />
                      </>
                    )}
                  </div>

                  {publicActivity.syncedAt ? (
                    <p className="font-serif text-xs text-gray-500 mt-4">
                      Derniere synchro: {new Date(publicActivity.syncedAt).toLocaleString('fr-FR')}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="font-serif text-gray-600">Aucune activite synchronisee visible pour le moment.</p>
              )}
            </section>

            <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
              <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700 mb-3">A voir ensemble</h2>
              <p className="font-serif text-sm text-gray-600 mb-4">
                Proposition basee sur vos habitudes communes (exclusion automatique des contenus deja termines par l un de vous).
              </p>
              <ActivityDetailCards
                entries={watchTogetherSuggestions}
                emptyLabel="Pas encore assez de points communs pour proposer une selection partagee."
                metaLabel={(entry) => `Type: ${String(entry?.type || 'media').toUpperCase()}`}
              />
            </section>
          </>
        ) : null}
      </div>
      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default UserProfile;
