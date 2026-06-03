import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setDisplayName(user?.displayName || '');
  }, [user?.displayName]);

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

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
          Mon profil
        </h1>

        {isAuthenticated ? (
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