import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLibrary, useTopPicks } from '../hooks/useLocalStorage';
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

function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { getLibrary, refreshLibraryMetadata } = useLibrary();
  const { getTopPicks, refreshTopPickTypes } = useTopPicks();

  const [stats, setStats] = useState(() => computeProfileStats([], []));
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const topPicks = getTopPicks();
    const library = getLibrary();
    setStats(computeProfileStats(library, topPicks));

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

  const handleLogout = () => {
    logout();
    navigate('/');
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
            <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
              <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-2">Compte connecte</p>
              <p className="text-2xl md:text-3xl font-display uppercase tracking-wider text-gray-700 mb-2">
                {user?.displayName || 'Utilisateur'}
              </p>
              <p className="font-serif text-gray-600 mb-6">{user?.email}</p>

              <div className="flex flex-wrap gap-3">
                <Link to="/library" className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm">
                  Ma bibliotheque
                </Link>
                <Link to="/settings" className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100">
                  Parametres
                </Link>
                <Link to="/planning" className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100">
                  Planning
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100"
                >
                  Deconnexion
                </button>
              </div>
            </section>

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
          </div>
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n etes pas connecte.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour retrouver votre profil et gerer votre compte.</p>
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
