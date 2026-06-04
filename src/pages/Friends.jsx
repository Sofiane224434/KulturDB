import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

function Friends() {
  const { isAuthenticated, user } = useAuth();

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [subscriptionsData, setSubscriptionsData] = useState({ followers: [], following: [], incomingRequests: [] });
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [friendActionId, setFriendActionId] = useState('');

  const loadSubscriptions = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoadingFriends(true);
      const data = await authApi.getSubscriptions();
      setSubscriptionsData({
        followers: Array.isArray(data.followers) ? data.followers : [],
        following: Array.isArray(data.following) ? data.following : [],
        incomingRequests: Array.isArray(data.incomingRequests) ? data.incomingRequests : [],
      });
    } catch (err) {
      setError(err.message || 'Impossible de charger les abonnements.');
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setSubscriptionsData({ followers: [], following: [], incomingRequests: [] });
      return;
    }

    loadSubscriptions();
  }, [isAuthenticated, user?.id]);

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

  const refreshSearch = async () => {
    if (!friendQuery.trim()) {
      return;
    }
    const refreshed = await authApi.searchUsers(friendQuery.trim());
    setFriendSearchResults(Array.isArray(refreshed.users) ? refreshed.users : []);
  };

  const handleFollowUser = async (targetUserId) => {
    try {
      setFriendActionId(`send-${targetUserId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.followUser(targetUserId);
      setSuccessMessage(data.message || 'Abonnement envoye.');
      await loadSubscriptions();
      await refreshSearch();
    } catch (err) {
      setError(err.message || 'Impossible de s abonner.');
    } finally {
      setFriendActionId('');
    }
  };

  const handleAcceptFollowRequest = async (requesterUserId) => {
    try {
      setFriendActionId(`accept-${requesterUserId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.acceptFollowRequest(requesterUserId);
      setSuccessMessage(data.message || 'Demande acceptee.');
      await loadSubscriptions();
      await refreshSearch();
    } catch (err) {
      setError(err.message || 'Impossible d accepter cette demande.');
    } finally {
      setFriendActionId('');
    }
  };

  const handleUnfollowUser = async (targetUserId) => {
    try {
      setFriendActionId(`remove-${targetUserId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.unfollowUser(targetUserId);
      setSuccessMessage(data.message || 'Abonnement supprime.');
      await loadSubscriptions();
      await refreshSearch();
    } catch (err) {
      setError(err.message || 'Impossible de supprimer cet abonnement.');
    } finally {
      setFriendActionId('');
    }
  };

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
          Abonnements
        </h1>

        {isAuthenticated ? (
          <section className="border-2 border-gray-300 bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-1">Gestion</p>
                <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700">Suivre des profils</h2>
              </div>
              {loadingFriends ? <span className="font-serif text-sm text-gray-500">Chargement...</span> : null}
            </div>

            {error ? <p className="text-sm text-red-700 font-serif mb-3">{error}</p> : null}
            {successMessage ? <p className="text-sm text-green-700 font-serif mb-3">{successMessage}</p> : null}

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
                      <p className="font-display uppercase tracking-wider text-gray-700">{person.displayName} {person.isFriend ? '🤝' : ''}</p>
                      <Link to={`/profile/${person.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                    </div>
                    {person.outgoingStatus === 'accepted' ? (
                      <button
                        type="button"
                        onClick={() => handleUnfollowUser(person.id)}
                        disabled={friendActionId === `remove-${person.id}`}
                        className="px-4 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {friendActionId === `remove-${person.id}` ? '...' : 'Se desabonner'}
                      </button>
                    ) : person.incomingStatus === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleAcceptFollowRequest(person.id)}
                        disabled={friendActionId === `accept-${person.id}`}
                        className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {friendActionId === `accept-${person.id}` ? '...' : 'Accepter la demande'}
                      </button>
                    ) : person.outgoingStatus === 'pending' ? (
                      <span className="px-4 py-2 border border-gray-300 bg-white text-gray-500 font-display uppercase tracking-wider text-xs">Demande en attente</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFollowUser(person.id)}
                        disabled={friendActionId === `send-${person.id}`}
                        className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {friendActionId === `send-${person.id}` ? '...' : 'S abonner'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="border border-gray-300 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Mes abonnes</p>
                <div className="space-y-2">
                  {subscriptionsData.followers.length ? subscriptionsData.followers.map((follower) => (
                    <div key={follower.id} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-3">
                      <div>
                        <p className="font-display uppercase tracking-wider text-gray-700">{follower.displayName} {follower.isFriend ? '🤝' : ''}</p>
                        <Link to={`/profile/${follower.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFollowUser(follower.id)}
                        disabled={friendActionId === `send-${follower.id}`}
                        className="px-3 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {friendActionId === `send-${follower.id}` ? '...' : 'Rendre abonnement'}
                      </button>
                    </div>
                  )) : <p className="font-serif text-sm text-gray-500">Aucun abonne pour le moment.</p>}
                </div>
              </div>

              <div className="border border-gray-300 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Demandes recues</p>
                <div className="space-y-2">
                  {subscriptionsData.incomingRequests.length ? subscriptionsData.incomingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-3">
                      <div>
                        <p className="font-display uppercase tracking-wider text-gray-700">{request.displayName}</p>
                        <Link to={`/profile/${request.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAcceptFollowRequest(request.id)}
                        disabled={friendActionId === `accept-${request.id}`}
                        className="px-3 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {friendActionId === `accept-${request.id}` ? '...' : 'Accepter'}
                      </button>
                    </div>
                  )) : <p className="font-serif text-sm text-gray-500">Aucune demande en attente.</p>}
                </div>
              </div>

              <div className="border border-gray-300 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Mes abonnements</p>
                <div className="space-y-2">
                  {subscriptionsData.following.length ? subscriptionsData.following.map((following) => (
                    <div key={following.id} className="flex items-center justify-between gap-2 border border-gray-300 bg-white p-3">
                      <div>
                        <p className="font-display uppercase tracking-wider text-gray-700">{following.displayName} {following.isFriend ? '🤝' : ''}</p>
                        <Link to={`/profile/${following.id}`} className="font-serif text-sm text-gray-500 underline hover:text-gray-700">Voir profil</Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnfollowUser(following.id)}
                        disabled={friendActionId === `remove-${following.id}`}
                        className="px-3 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {friendActionId === `remove-${following.id}` ? '...' : 'Se desabonner'}
                      </button>
                    </div>
                  )) : <p className="font-serif text-sm text-gray-500">Aucun abonnement pour le moment.</p>}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n etes pas connecte.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour gerer vos abonnements.</p>
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

export default Friends;
