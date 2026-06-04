import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import { tmdbService } from '../services/tmdb';

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
  const { isAuthenticated, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [social, setSocial] = useState({ followersCount: 0, followingCount: 0, followers: [], following: [] });
  const [canViewFull, setCanViewFull] = useState(false);
  const [publicActivity, setPublicActivity] = useState(null);
  const [profileComments, setProfileComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [activeDetail, setActiveDetail] = useState('topPicks');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = async (targetUserId) => {
    const data = await authApi.getUserProfile(targetUserId);
    setProfile(data.user || null);
    setRelationship(data.relationship || null);
    setCanViewFull(!!data.canViewFull);
    setSocial(data.social || { followersCount: 0, followingCount: 0, followers: [], following: [] });
    setPublicActivity(data.publicActivity || null);

    if (data.canViewFull) {
      const commentsData = await authApi.getProfileComments(targetUserId);
      setProfileComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
    } else {
      setProfileComments([]);
    }
  };

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
        if (!cancelled) {
          await loadProfile(userId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossible de charger ce profil.');
          setProfile(null);
          setRelationship(null);
          setSocial({ followersCount: 0, followingCount: 0, followers: [], following: [] });
          setCanViewFull(false);
          setPublicActivity(null);
          setProfileComments([]);
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

  const handleFollowAction = async (action) => {
    try {
      setActionLoading(true);
      setError('');

      if (action === 'follow') {
        await authApi.followUser(userId);
      } else if (action === 'accept') {
        await authApi.acceptFollowRequest(userId);
      } else if (action === 'unfollow') {
        await authApi.unfollowUser(userId);
      }

      await loadProfile(userId);
    } catch (err) {
      setError(err.message || 'Action impossible.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    const content = String(commentDraft || '').trim();
    if (content.length < 2) {
      setError('Le commentaire doit contenir au moins 2 caracteres.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      const data = await authApi.addProfileComment(userId, content);
      setProfileComments(Array.isArray(data.comments) ? data.comments : []);
      setCommentDraft('');
    } catch (err) {
      setError(err.message || 'Impossible d ajouter le commentaire.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      setActionLoading(true);
      setError('');
      const data = await authApi.deleteProfileComment(userId, commentId);
      setProfileComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      setError(err.message || 'Impossible de supprimer le commentaire.');
    } finally {
      setActionLoading(false);
    }
  };

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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border border-gray-300 bg-gray-100 overflow-hidden flex items-center justify-center">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-2xl text-gray-500">{String(profile.displayName || '?').slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-2">Utilisateur</p>
                    <p className="text-3xl md:text-4xl font-display uppercase tracking-wider text-gray-700 mb-2">{profile.displayName} {relationship?.isFriend ? '🤝' : ''}</p>
                    <p className="font-serif text-gray-600">Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <p className="font-serif text-sm text-gray-600">Abonnes: {social.followersCount || 0}</p>
                  <p className="font-serif text-sm text-gray-600">Abonnements: {social.followingCount || 0}</p>
                  {user?.id === profile.id ? null : relationship?.outgoingStatus === 'accepted' ? (
                    <button
                      type="button"
                      onClick={() => handleFollowAction('unfollow')}
                      disabled={actionLoading}
                      className="px-3 py-2 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                    >
                      Se desabonner
                    </button>
                  ) : relationship?.incomingStatus === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => handleFollowAction('accept')}
                      disabled={actionLoading}
                      className="px-3 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                    >
                      Accepter la demande
                    </button>
                  ) : relationship?.outgoingStatus === 'pending' ? (
                    <span className="px-3 py-2 border border-gray-300 bg-white text-gray-500 font-display uppercase tracking-wider text-xs">Demande en attente</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleFollowAction('follow')}
                      disabled={actionLoading}
                      className="px-3 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                    >
                      S abonner
                    </button>
                  )}
                </div>
              </div>
            </section>

            {!canViewFull ? (
              <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
                <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700 mb-3">Profil prive</h2>
                <p className="font-serif text-gray-600">Ce profil est prive. Envoie une demande d abonnement et attends son acceptation pour voir l activite complete.</p>
              </section>
            ) : null}

            {canViewFull ? (
              <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
                <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700 mb-3">Reseau</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-300 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Abonnes</p>
                    <div className="space-y-2 max-h-64 overflow-auto pr-1">
                      {social.followers?.length ? social.followers.map((entry) => (
                        <Link key={`follower-${entry.id}`} to={`/profile/${entry.id}`} className="flex items-center justify-between border border-gray-300 bg-white p-2 hover:bg-gray-100">
                          <span className="font-display uppercase tracking-wider text-gray-700 text-sm">{entry.displayName} {entry.isFriend ? '🤝' : ''}</span>
                        </Link>
                      )) : <p className="font-serif text-sm text-gray-500">Aucun abonne visible.</p>}
                    </div>
                  </div>
                  <div className="border border-gray-300 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-display mb-3">Abonnements</p>
                    <div className="space-y-2 max-h-64 overflow-auto pr-1">
                      {social.following?.length ? social.following.map((entry) => (
                        <Link key={`following-${entry.id}`} to={`/profile/${entry.id}`} className="flex items-center justify-between border border-gray-300 bg-white p-2 hover:bg-gray-100">
                          <span className="font-display uppercase tracking-wider text-gray-700 text-sm">{entry.displayName} {entry.isFriend ? '🤝' : ''}</span>
                        </Link>
                      )) : <p className="font-serif text-sm text-gray-500">Aucun abonnement visible.</p>}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {canViewFull ? (
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
            ) : null}

            {canViewFull ? (
              <section className="border-2 border-gray-300 bg-white p-6 md:p-10">
                <h2 className="text-2xl font-display uppercase tracking-wider text-gray-700 mb-3">Commentaires du profil</h2>
                <form onSubmit={handleCommentSubmit} className="mb-4 flex flex-col gap-3">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    className="w-full min-h-24 px-3 py-2 border border-gray-400 bg-white text-gray-800 font-serif"
                    placeholder="Laisser un commentaire sur ce profil..."
                    maxLength={500}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                    >
                      Publier
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  {profileComments.length ? profileComments.map((comment) => (
                    <article key={`profile-comment-${comment.id}`} className="border border-gray-300 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-display uppercase tracking-wider text-sm text-gray-700">{comment.author?.displayName || 'Utilisateur'}</p>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={actionLoading}
                          hidden={!(comment.author?.id === user?.id || profile?.id === user?.id)}
                          className="px-2 py-1 border border-gray-400 bg-white text-gray-700 font-display uppercase tracking-wider text-xs disabled:opacity-60"
                        >
                          Supprimer
                        </button>
                      </div>
                      <p className="font-serif text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </article>
                  )) : <p className="font-serif text-sm text-gray-500">Aucun commentaire pour le moment.</p>}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default UserProfile;
