import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

function Friends() {
  const { isAuthenticated, user } = useAuth();

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [friendsData, setFriendsData] = useState({ friends: [], incomingRequests: [], outgoingRequests: [] });
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [friendActionId, setFriendActionId] = useState('');

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

  const handleSendFriendRequest = async (targetUserId) => {
    try {
      setFriendActionId(`send-${targetUserId}`);
      setError('');
      setSuccessMessage('');
      const data = await authApi.sendFriendRequest(targetUserId);
      setSuccessMessage(data.message || 'Demande envoyee.');
      await loadFriends();
      await refreshSearch();
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
      await refreshSearch();
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
      await refreshSearch();
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
          Amis
        </h1>

        {isAuthenticated ? (
          <section className="border-2 border-gray-300 bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-1">Gestion</p>
                <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700">Ajouter des gens du site</h2>
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
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n etes pas connecte.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour gerer vos amis.</p>
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
