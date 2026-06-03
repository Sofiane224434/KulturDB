import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
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
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossible de charger ce profil.');
          setProfile(null);
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
              <p className="font-serif text-gray-600">
                Les tops, visionnages, commentaires et notes seront affiches ici quand la synchronisation multi-utilisateur sera activee.
              </p>
            </section>
          </>
        ) : null}
      </div>
      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default UserProfile;
