import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MediaCard from '../components/MediaCard';
import Modal from '../components/Modal';
import { tmdbService } from '../services/tmdb';
import { useFavorites, useComments, useRatings, useWatchlist } from '../hooks/useLocalStorage';

function SeriesDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [series, setSeries] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [trailer, setTrailer] = useState(null);
    
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const { getComments, addComment, deleteComment } = useComments();
    const { getRating, setRating } = useRatings();
    const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
    
    const [isFav, setIsFav] = useState(false);
    const [userRating, setUserRating] = useState(0);
    const [isInWatch, setIsInWatch] = useState(false);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [seasonDetails, setSeasonDetails] = useState(null);
    const [loadingSeason, setLoadingSeason] = useState(false);

    useEffect(() => {
        const fetchSeries = async () => {
            try {
                const [seriesData, videosData] = await Promise.all([
                    tmdbService.getSeriesDetails(id),
                    tmdbService.getSeriesVideos(id)
                ]);
                setSeries(seriesData);
                setIsFav(isFavorite(parseInt(id)));
                setUserRating(getRating(id));
                setIsInWatch(isInWatchlist(parseInt(id), 'series'));
                setComments(getComments(id));
                
                // Trouver la bande-annonce (français ou anglais)
                const trailerVideo = videosData.results?.find(
                    v => v.type === 'Trailer' && v.site === 'YouTube'
                ) || videosData.results?.find(
                    v => v.site === 'YouTube'
                );
                setTrailer(trailerVideo);
            } catch (error) {
                console.error('Erreur:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSeries();
    }, [id]);

    const handleFavoriteToggle = () => {
        if (isFav) {
            removeFavorite(parseInt(id));
        } else {
            addFavorite({ id: series.id, name: series.name, poster_path: series.poster_path }, 'series');
        }
        setIsFav(!isFav);
    };

    const handleSubmitComment = (e) => {
        e.preventDefault();
        if (commentText.trim()) {
            const updated = addComment(id, commentText, replyTo);
            setComments(updated);
            setCommentText('');
            setReplyTo(null);
        }
    };

    const handleDeleteComment = (commentId) => {
        const updated = deleteComment(id, commentId);
        setComments(updated);
    };

    const handleRating = (rating) => {
        setRating(id, rating);
        setUserRating(rating);
    };

    const handleWatchlistToggle = () => {
        if (isInWatch) {
            removeFromWatchlist(parseInt(id), 'series');
        } else {
            addToWatchlist(
                {
                    id: series.id,
                    name: series.name,
                    poster_path: series.poster_path,
                    vote_average: series.vote_average,
                },
                'series',
            );
        }
        setIsInWatch(!isInWatch);
    };

    const handleSeasonClick = async (season) => {
        setSelectedSeason(season);
        setLoadingSeason(true);
        try {
            const details = await tmdbService.getSeasonDetails(id, season.season_number);
            setSeasonDetails(details);
        } catch (error) {
            console.error('Erreur:', error);
        } finally {
            setLoadingSeason(false);
        }
    };

    const closeModal = () => {
        setSelectedSeason(null);
        setSeasonDetails(null);
    };

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
            </div>
        );
    }

    const posterUrl = tmdbService.getImageUrl(series.poster_path, 'w500');
    const backdropUrl = tmdbService.getImageUrl(series.backdrop_path, 'w1280');

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            
            <div>
            {backdropUrl && (
                <div className="relative h-48 sm:h-64 md:h-96 mb-8 md:mb-12">
                    <img src={backdropUrl} alt={series.name} className="w-full h-full object-cover grayscale opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#f5f5f0] to-transparent"></div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-6 md:mb-8 px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-display uppercase tracking-wider bg-gray-800 text-gray-400 hover:text-white transition-colors border-2 border-gray-900 inline-flex items-center gap-2"
                >
                    <span>←</span> Retour
                </button>
                
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-16">
                    {/* COLONNE GAUCHE */}
                    <div className="min-w-0">
                        {posterUrl && (
                            <img src={posterUrl} alt={series.name} className="w-full border-4 border-gray-800 mb-6" />
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* Note personnelle */}
                            <div className="bg-gray-800 border-2 border-gray-900 p-4 text-center">
                                <p className="text-xs font-display uppercase tracking-wider text-gray-400 mb-2">Ma Note</p>
                                <div className="text-4xl font-display text-yellow-500 mb-2">
                                    {userRating > 0 ? userRating : '-'}
                                    <span className="text-2xl text-gray-600">/5</span>
                                </div>
                                <div className="flex justify-center gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => handleRating(star)}
                                            className={`text-xl transition-colors ${
                                                star <= userRating ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-400'
                                            }`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                {userRating > 0 && (
                                    <button
                                        onClick={() => handleRating(0)}
                                        className="text-xs text-gray-500 hover:text-gray-300 font-serif"
                                    >
                                        Effacer
                                    </button>
                                )}
                            </div>
                            
                            {/* Note TMDB */}
                            <div className="bg-yellow-500 border-4 border-gray-800 p-4 text-center">
                                <p className="text-xs font-display uppercase tracking-wider text-gray-800 mb-2">Note TMDB</p>
                                <div className="text-5xl font-display text-gray-900 leading-none">
                                    {series.vote_average.toFixed(1)}
                                </div>
                                <div className="text-2xl font-display text-gray-700 mt-1">/10</div>
                                <p className="text-xs font-serif text-gray-700 mt-2">{series.vote_count.toLocaleString()}</p>
                            </div>
                        </div>
                        
                        <button
                            onClick={handleFavoriteToggle}
                            className="w-full mb-2 px-6 py-3 font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white transition-colors border-2 border-gray-800"
                        >
                            {isFav ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}
                        </button>
                        
                        <button
                            onClick={handleWatchlistToggle}
                            className="w-full mb-6 px-6 py-3 font-display uppercase tracking-wider bg-gray-700 text-gray-400 hover:text-white transition-colors border-2 border-gray-800"
                        >
                            {isInWatch ? '✓ Dans ma médiathèque' : '+ Ajouter à ma médiathèque'}
                        </button>
                        
                        {/* Infos supplémentaires */}
                        <div className="bg-white border-2 border-gray-400 p-6">
                            <h3 className="font-display text-xl uppercase tracking-wider text-gray-600 mb-4">Informations</h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Statut</p>
                                    <p className="font-serif text-sm text-gray-700">
                                        {series.status === 'Returning Series' ? 'En production' : 
                                         series.status === 'Ended' ? 'Terminée' : 
                                         series.status === 'Canceled' ? 'Annulée' : series.status}
                                    </p>
                                </div>
                                
                                <div>
                                    <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Saisons / Épisodes</p>
                                    <p className="font-serif text-sm text-gray-700">
                                        {series.number_of_seasons} saison{series.number_of_seasons > 1 ? 's' : ''} • {series.number_of_episodes} épisodes
                                    </p>
                                </div>
                                
                                <div>
                                    <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Langue Originale</p>
                                    <p className="font-serif text-sm text-gray-700">{series.original_language.toUpperCase()}</p>
                                </div>
                                
                                {series.languages && series.languages.length > 0 && (
                                    <div>
                                        <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Langues Parlées</p>
                                        <p className="font-serif text-sm text-gray-700">
                                            {series.languages.map(l => l.toUpperCase()).join(', ')}
                                        </p>
                                    </div>
                                )}
                                
                                {series.origin_country && series.origin_country.length > 0 && (
                                    <div>
                                        <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Pays d'Origine</p>
                                        <p className="font-serif text-sm text-gray-700">
                                            {series.origin_country.join(', ')}
                                        </p>
                                    </div>
                                )}
                                
                                {series.networks && series.networks.length > 0 && (
                                    <div>
                                        <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Réseau</p>
                                        <p className="font-serif text-sm text-gray-700">{series.networks[0].name}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLONNE DROITE */}
                    <div className="min-w-0">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-600 mb-4 break-words">
                            {series.name}
                        </h1>
                        
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6 font-serif text-sm md:text-base text-gray-600">
                            <span>{new Date(series.first_air_date).getFullYear()}</span>
                            {series.last_air_date && series.last_air_date !== series.first_air_date && (
                                <>
                                    <span>-</span>
                                    <span>{new Date(series.last_air_date).getFullYear()}</span>
                                </>
                            )}
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <span className="text-yellow-600">★</span>
                                {series.vote_average.toFixed(1)}
                            </span>
                        </div>
                        
                        {trailer && (
                            <div className="mb-6">
                                <div className="aspect-video border-4 border-gray-800">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={`https://www.youtube.com/embed/${trailer.key}`}
                                        title="Bande-annonce"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            </div>
                        )}

                        <p className="text-lg font-serif text-gray-700 mb-6 leading-relaxed">
                            {series.overview}
                        </p>

                        <div className="mb-6">
                            <h3 className="font-display text-xl uppercase tracking-wider text-gray-600 mb-2">Genres</h3>
                            <div className="flex flex-wrap gap-2">
                                {series.genres.map(g => (
                                    <span key={g.id} className="font-display text-sm uppercase tracking-wider text-gray-700 bg-gray-200 px-3 py-1 border border-gray-400">
                                        {g.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        {/* Traductions disponibles */}
                        {series.translations && series.translations.translations && series.translations.translations.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-display text-xl uppercase tracking-wider text-gray-600 mb-2">Traductions Disponibles</h3>
                                <div className="flex flex-wrap gap-2">
                                    {series.translations.translations.slice(0, 10).map((trans, idx) => (
                                        <span key={idx} className="text-xs font-display uppercase tracking-wider text-gray-500 bg-gray-200 px-2 py-1 border border-gray-400">
                                            {trans.iso_639_1.toUpperCase()}
                                        </span>
                                    ))}
                                    {series.translations.translations.length > 10 && (
                                        <span className="text-xs font-display text-gray-500">+{series.translations.translations.length - 10}</span>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Détails des saisons - CLIQUABLES */}
                        {series.seasons && series.seasons.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-display text-2xl uppercase tracking-wider text-gray-600 mb-4">Saisons</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {series.seasons.filter(s => s.season_number > 0).map((season) => (
                                        <button
                                            key={season.id}
                                            onClick={() => handleSeasonClick(season)}
                                            className="border-2 border-gray-400 p-3 bg-white hover:bg-gray-100 hover:border-gray-600 transition-all text-left group"
                                        >
                                            <p className="font-display text-sm uppercase tracking-wider text-gray-700 group-hover:text-gray-900 mb-1">
                                                {season.name}
                                            </p>
                                            <p className="font-serif text-xs text-gray-600">
                                                {season.episode_count} épisode{season.episode_count > 1 ? 's' : ''}
                                                {season.air_date && ` • ${new Date(season.air_date).getFullYear()}`}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {series.credits && series.credits.cast && (
                            <div className="mb-8">
                                <h3 className="font-display text-2xl uppercase tracking-wider text-gray-600 mb-4">Casting</h3>
                                <div className="flex gap-4 overflow-x-auto pb-4">
                                    {series.credits.cast.slice(0, 10).map(actor => (
                                        <Link 
                                            key={actor.id} 
                                            to={`/person/${actor.id}`}
                                            className="flex-shrink-0 w-32 group cursor-pointer"
                                        >
                                            {actor.profile_path ? (
                                                <img 
                                                    src={tmdbService.getImageUrl(actor.profile_path, 'w185')}
                                                    alt={actor.name}
                                                    className="w-full h-40 object-cover border-2 border-gray-800 mb-2 grayscale group-hover:grayscale-0 transition-all"
                                                />
                                            ) : (
                                                <div className="w-full h-40 bg-gray-300 border-2 border-gray-800 mb-2 flex items-center justify-center">
                                                    <span className="text-gray-600 text-3xl font-display">?</span>
                                                </div>
                                            )}
                                            <p className="font-display text-sm text-gray-700 group-hover:text-gray-900">{actor.name}</p>
                                            <p className="font-serif text-xs text-gray-500">{actor.character}</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Créateurs et équipe */}
                        {series.credits && series.credits.crew && (
                            <div className="mb-8">
                                <h3 className="font-display text-2xl uppercase tracking-wider text-gray-600 mb-4">Équipe</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {series.credits.crew
                                        .filter(c => ['Executive Producer', 'Director', 'Writer', 'Creator'].includes(c.job))
                                        .slice(0, 6)
                                        .map((crew, idx) => (
                                            <Link 
                                                key={`${crew.id}-${idx}`}
                                                to={`/person/${crew.id}`}
                                                className="bg-gray-100 border border-gray-400 p-3 hover:bg-gray-200 transition-colors"
                                            >
                                                <p className="font-display text-sm uppercase tracking-wider text-gray-700">{crew.name}</p>
                                                <p className="font-serif text-xs text-gray-500">{crew.job}</p>
                                            </Link>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {series.similar && series.similar.results.length > 0 && (
                    <section className="mb-16">
                        <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-gray-600 mb-8 break-words">
                            <span className="text-4xl sm:text-5xl text-gray-800">S</span>éries similaires
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-8">
                            {series.similar.results.slice(0, 5).map(similar => (
                                <MediaCard key={similar.id} item={similar} type="series" />
                            ))}
                        </div>
                    </section>
                )}

                {/* Critiques TMDB */}
                {series.reviews && series.reviews.results && series.reviews.results.length > 0 && (
                    <section className="mb-16">
                        <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-gray-600 mb-8 break-words">
                            <span className="text-4xl sm:text-5xl text-gray-800">C</span>ritiques TMDB
                        </h2>
                        <div className="space-y-6">
                            {series.reviews.results.slice(0, 5).map((review) => {
                                const [expanded, setExpanded] = React.useState(false);
                                const isLong = review.content.length > 500;
                                const avatarPath = review.author_details?.avatar_path;
                                const avatarUrl = avatarPath 
                                    ? (avatarPath.startsWith('/https') 
                                        ? avatarPath.substring(1) 
                                        : `https://image.tmdb.org/t/p/w64${avatarPath}`)
                                    : null;
                                
                                return (
                                    <div key={review.id} className="border-2 border-gray-400 p-6 bg-white">
                                        <div className="flex gap-4 mb-4">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0">
                                                {avatarUrl ? (
                                                    <img 
                                                        src={avatarUrl} 
                                                        alt={review.author}
                                                        className="w-16 h-16 rounded-full border-2 border-gray-800 object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-full bg-gray-300 border-2 border-gray-800 flex items-center justify-center">
                                                        <span className="text-2xl font-display text-gray-600">
                                                            {review.author[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Infos auteur */}
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-display text-lg uppercase tracking-wider text-gray-700">
                                                                {review.author}
                                                            </p>
                                                            {review.author_details?.username && review.author_details.username !== review.author && (
                                                                <span className="font-serif text-sm text-gray-500">@{review.author_details.username}</span>
                                                            )}
                                                        </div>
                                                        <p className="font-serif text-xs text-gray-500">
                                                            {new Date(review.created_at).toLocaleDateString('fr-FR', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                            {review.updated_at && review.updated_at !== review.created_at && (
                                                                <span className="ml-2 italic">
                                                                    (modifié le {new Date(review.updated_at).toLocaleDateString('fr-FR')})
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Note */}
                                                    {review.author_details?.rating && (
                                                        <div className="bg-yellow-500 px-3 py-2 border-2 border-gray-800">
                                                            <span className="font-display text-sm">★ {review.author_details.rating}/10</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Contenu de la critique */}
                                                <div className="font-serif text-gray-700 leading-relaxed">
                                                    <p className={!expanded && isLong ? 'line-clamp-6' : ''}>
                                                        {review.content}
                                                    </p>
                                                    {isLong && (
                                                        <button
                                                            onClick={() => setExpanded(!expanded)}
                                                            className="mt-2 text-sm font-display uppercase tracking-wider text-gray-600 hover:text-gray-800 underline"
                                                        >
                                                            {expanded ? '↑ Voir moins' : '↓ Voir plus'}
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Lien source */}
                                                {review.url && (
                                                    <a 
                                                        href={review.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-3 text-xs font-display uppercase tracking-wider text-gray-500 hover:text-gray-700 transition-colors"
                                                    >
                                                        <span>Voir sur TMDB</span>
                                                        <span>→</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section className="border-t-2 border-gray-800 pt-12">
                    <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-gray-600 mb-8 break-words">
                        <span className="text-4xl sm:text-5xl text-gray-800">C</span>ommentaires
                    </h2>

                    <form onSubmit={handleSubmitComment} className="mb-8">
                        {replyTo && (
                            <div className="mb-2 text-sm font-serif text-gray-600">
                                Réponse à un commentaire - <button onClick={() => setReplyTo(null)} className="underline">Annuler</button>
                            </div>
                        )}
                        <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Votre commentaire..."
                            className="w-full p-4 border-2 border-gray-800 font-serif text-gray-700 focus:outline-none focus:border-gray-600 mb-4"
                            rows="4"
                        />
                        <button
                            type="submit"
                            className="px-8 py-3 font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white transition-colors border-2 border-gray-800"
                        >
                            Publier
                        </button>
                    </form>

                    <div className="space-y-6">
                        {comments.filter(c => !c.parentId).map(comment => (
                            <div key={comment.id} className="border-2 border-gray-300 p-6">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-display text-sm uppercase tracking-wider text-gray-700">{comment.author}</p>
                                        <p className="font-serif text-xs text-gray-500">
                                            {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-gray-500 hover:text-red-600 text-sm"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                                <p className="font-serif text-gray-700 mb-3">{comment.text}</p>
                                <button
                                    onClick={() => setReplyTo(comment.id)}
                                    className="text-sm font-display uppercase tracking-wider text-gray-600 hover:text-gray-800"
                                >
                                    Répondre
                                </button>

                                {comments.filter(r => r.parentId === comment.id).map(reply => (
                                    <div key={reply.id} className="ml-8 mt-4 border-l-2 border-gray-300 pl-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-display text-sm uppercase tracking-wider text-gray-700">{reply.author}</p>
                                                <p className="font-serif text-xs text-gray-500">
                                                    {new Date(reply.createdAt).toLocaleDateString('fr-FR')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteComment(reply.id)}
                                                className="text-gray-500 hover:text-red-600 text-sm"
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                        <p className="font-serif text-gray-700">{reply.text}</p>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
            </div>
            
            {/* Modal pour les épisodes de la saison */}
            <Modal 
                isOpen={selectedSeason !== null} 
                onClose={closeModal}
                title={selectedSeason?.name || ''}
            >
                {loadingSeason ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-800 border-t-transparent"></div>
                    </div>
                ) : seasonDetails && seasonDetails.episodes ? (
                    <div className="space-y-4">
                        {seasonDetails.overview && (
                            <p className="font-serif text-gray-700 mb-6 leading-relaxed pb-4 border-b-2 border-gray-300">
                                {seasonDetails.overview}
                            </p>
                        )}
                        
                        <div className="space-y-3">
                            {seasonDetails.episodes.map((episode) => (
                                <div key={episode.id} className="border-2 border-gray-300 p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex gap-4">
                                        {episode.still_path && (
                                            <img 
                                                src={tmdbService.getImageUrl(episode.still_path, 'w300')}
                                                alt={episode.name}
                                                className="w-32 h-18 object-cover border-2 border-gray-800"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="font-display text-lg uppercase tracking-wider text-gray-700">
                                                    {episode.episode_number}. {episode.name}
                                                </h4>
                                                {episode.vote_average > 0 && (
                                                    <span className="flex items-center gap-1 font-serif text-sm text-gray-600">
                                                        <span className="text-yellow-600">★</span>
                                                        {episode.vote_average.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                            {episode.air_date && (
                                                <p className="font-serif text-xs text-gray-500 mb-2">
                                                    {new Date(episode.air_date).toLocaleDateString('fr-FR', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    })}
                                                    {episode.runtime && ` • ${episode.runtime} min`}
                                                </p>
                                            )}
                                            {episode.overview && (
                                                <p className="font-serif text-sm text-gray-600 line-clamp-3">
                                                    {episode.overview}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-center font-serif text-gray-600 py-8">
                        Aucune information d'épisode disponible.
                    </p>
                )}
            </Modal>
            
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default SeriesDetail;
