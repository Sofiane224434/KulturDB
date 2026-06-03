import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [publicActivity, setPublicActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Top personnels</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.topPicks || 0}</p>
                    </div>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Elements suivis</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.tracked || 0}</p>
                    </div>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Termines</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.completed || 0}</p>
                    </div>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Notes</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.ratings || 0}</p>
                    </div>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Moyenne notes</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">
                        {publicActivity.ratingsAverage != null ? publicActivity.ratingsAverage : '-'}
                      </p>
                    </div>
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Commentaires</p>
                      <p className="text-2xl font-display uppercase tracking-wider text-gray-800">{publicActivity.counts?.comments || 0}</p>
                    </div>
                  </div>

                  {Array.isArray(publicActivity.recentTopPicks) && publicActivity.recentTopPicks.length > 0 ? (
                    <div className="border border-gray-300 bg-white p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Derniers tops</p>
                      <ul className="space-y-2">
                        {publicActivity.recentTopPicks.map((entry, index) => (
                          <li key={`${entry.type}-${entry.id}-${index}`} className="font-serif text-gray-700">
                            {index + 1}. {entry.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="font-serif text-gray-600">Aucune activite synchronisee visible pour le moment.</p>
                  )}

                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Detail elements suivis</p>
                      {Array.isArray(publicActivity.details?.tracked) && publicActivity.details.tracked.length > 0 ? (
                        <ul className="space-y-2">
                          {publicActivity.details.tracked.map((entry, index) => (
                            <li key={`tracked-${entry.type}-${entry.id}-${index}`} className="font-serif text-sm text-gray-700">
                              {entry.title} - {entry.progressCurrent}/{entry.progressTotal || '?'} {entry.progressUnit || 'element'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif text-sm text-gray-500">Aucun element suivi.</p>
                      )}
                    </div>

                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Detail termines</p>
                      {Array.isArray(publicActivity.details?.completed) && publicActivity.details.completed.length > 0 ? (
                        <ul className="space-y-2">
                          {publicActivity.details.completed.map((entry, index) => (
                            <li key={`completed-${entry.type}-${entry.id}-${index}`} className="font-serif text-sm text-gray-700">
                              {entry.title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif text-sm text-gray-500">Aucun element termine.</p>
                      )}
                    </div>

                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Detail notes</p>
                      {Array.isArray(publicActivity.details?.ratings) && publicActivity.details.ratings.length > 0 ? (
                        <ul className="space-y-2">
                          {publicActivity.details.ratings.map((entry, index) => (
                            <li key={`rating-${entry.itemId}-${index}`} className="font-serif text-sm text-gray-700">
                              {entry.title} - {entry.value}/5
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif text-sm text-gray-500">Aucune note.</p>
                      )}
                    </div>

                    <div className="border border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-2">Detail commentaires</p>
                      {Array.isArray(publicActivity.details?.comments) && publicActivity.details.comments.length > 0 ? (
                        <ul className="space-y-2">
                          {publicActivity.details.comments.map((entry, index) => (
                            <li key={`comment-${entry.itemId}-${index}`} className="font-serif text-sm text-gray-700">
                              {entry.title} - {entry.count} commentaire(s)
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="font-serif text-sm text-gray-500">Aucun commentaire.</p>
                      )}
                    </div>
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
          </>
        ) : null}
      </div>
      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default UserProfile;
