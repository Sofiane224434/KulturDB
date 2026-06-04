import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUiPreferences } from '../context/UiPreferencesContext';
import { authApi } from '../services/authApi';

function Settings() {
  const { isAuthenticated, user, setUser } = useAuth();
  const { preferences, updatePreferences } = useUiPreferences();

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setDisplayName(user?.displayName || '');
  }, [user?.displayName]);

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

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
          Parametres
        </h1>

        {isAuthenticated ? (
          <section className="border-2 border-gray-300 bg-white p-6 md:p-8 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-2">Compte</p>
              <p className="text-2xl md:text-3xl font-display uppercase tracking-wider text-gray-700 mb-2">
                {user?.displayName || 'Utilisateur'}
              </p>
              <p className="font-serif text-gray-600">{user?.email}</p>
            </div>

            <form onSubmit={handleUpdateDisplayName} className="border border-gray-300 bg-gray-50 p-4">
              <label htmlFor="displayName" className="block text-xs uppercase tracking-wider text-gray-500 font-display mb-2">
                Changer mon pseudo
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
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

            <div className="border border-gray-300 bg-gray-50 p-4">
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

            <div className="flex flex-wrap gap-3">
              <Link to="/profile" className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100">
                Retour profil
              </Link>
            </div>
          </section>
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n etes pas connecte.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour modifier vos parametres.</p>
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

export default Settings;
