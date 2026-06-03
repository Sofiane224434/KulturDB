import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUiPreferences } from '../context/UiPreferencesContext';
import { useLibrary, useTopPicks } from '../hooks/useLocalStorage';
import { authApi } from '../services/authApi';
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
  const { isAuthenticated, user, logout, setUser } = useAuth();
  const { preferences, updatePreferences } = useUiPreferences();
  const { getLibrary, refreshLibraryMetadata } = useLibrary();
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

  useEffect(() => {
    setDisplayName(user?.displayName || '');
  }, [user?.displayName]);

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