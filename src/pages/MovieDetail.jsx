import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import MediaCard from '../components/MediaCard';
import { tmdbService } from '../services/tmdb';
import { useFavorites, useComments, useRatings, useLibrary } from '../hooks/useLocalStorage';

function MovieDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [trailer, setTrailer] = useState(null);
    
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const { getComments, addComment, deleteComment } = useComments();
    const { getRating, setRating } = useRatings();
    const { isInLibrary, addToLibrary, removeFromLibrary } = useLibrary();
    
    const [isFav, setIsFav] = useState(false);
    const [inLibrary, setInLibrary] = useState(false);
    const [userRating, setUserRating] = useState(0);

    useEffect(() => {
        const fetchMovie = async () => {
            try {
                const [movieData, videosData] = await Promise.all([
                    tmdbService.getMovieDetails(id),
                    tmdbService.getMovieVideos(id)
                ]);
                setMovie(movieData);
                setIsFav(isFavorite(parseInt(id)));
                setInLibrary(isInLibrary(id, 'movie'));
                setUserRating(getRating(id));
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

        fetchMovie();
    }, [id]);

    const handleFavoriteToggle = () => {
        if (isFav) {
            removeFavorite(parseInt(id));
        } else {
            addFavorite({ id: movie.id, title: movie.title, poster_path: movie.poster_path }, 'movie');
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

    const handleLibraryToggle = () => {
        if (!movie) {
            return;
        }

        if (inLibrary) {
            removeFromLibrary(id, 'movie');
            setInLibrary(false);
            return;
        }

        addToLibrary(
            {
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
                source: 'TMDB',
            },
            'movie',
            {
                progressUnit: 'film',
                progressTotal: 1,
            },
        );
        setInLibrary(true);
    };

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
            </div>
        );
    }

    const posterUrl = tmdbService.getImageUrl(movie.poster_path, 'w500');
    const backdropUrl = tmdbService.getImageUrl(movie.backdrop_path, 'w1280');

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            
            <div>
            {backdropUrl && (
                <div className="relative h-48 sm:h-64 md:h-96 mb-8 md:mb-12">
                    <img src={backdropUrl} alt={movie.title} className="w-full h-full object-cover grayscale opacity-40" />
                    <div className="absolute inset-0 bg-linear-to-t from-[#f5f5f0] to-transparent"></div>
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
                            <img src={posterUrl} alt={movie.title} className="w-full border-4 border-gray-800 mb-6" />
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
                                    {movie.vote_average.toFixed(1)}
                                </div>
                                <div className="text-2xl font-display text-gray-700 mt-1">/10</div>
                                <p className="text-xs font-serif text-gray-700 mt-2">{movie.vote_count.toLocaleString()}</p>
                            </div>
                        </div>
                        
                        <button
                            onClick={handleFavoriteToggle}
                            className="w-full mb-2 px-6 py-3 font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white transition-colors border-2 border-gray-800"
                        >
                            {isFav ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}
                        </button>
                        
                        <button
                            onClick={handleLibraryToggle}
                            className="w-full mb-6 px-6 py-3 font-display uppercase tracking-wider bg-gray-700 text-gray-200 hover:text-white transition-colors border-2 border-gray-800"
                        >
                            {inLibrary ? '✓ Retirer de ma bibliothèque' : '+ Ajouter à ma bibliothèque'}
                        </button>
                        
                        {/* Infos supplémentaires */}
                        <div className="bg-white border-2 border-gray-400 p-6">
                            <h3 className="font-display text-xl uppercase tracking-wider text-gray-600 mb-4">Informations</h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Statut</p>
                                    <p className="font-serif text-sm text-gray-700">{movie.status === 'Released' ? 'Sorti' : movie.status}</p>
                                </div>
                                
                                <div>
                                    <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Langue Originale</p>
                                    <p className="font-serif text-sm text-gray-700">{movie.original_language.toUpperCase()}</p>
                                </div>
                                
                                {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                                    <div>
                                        <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Langues Parlées</p>
                                        <p className="font-serif text-sm text-gray-700">
                                            {movie.spoken_languages.map(l => l.name).join(', ')}
                                        </p>
                                    </div>
                                )}
                                
                                {movie.production_countries && movie.production_countries.length > 0 && (
                                    <div>
                                        <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Pays de Production</p>
                                        <p className="font-serif text-sm text-gray-700">
                                            {movie.production_countries.map(c => c.name).join(', ')}
                                        </p>
                                    </div>
                                )}
                                
                                {movie.budget > 0 && (
                                    <div>
                                        <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-1">Budget</p>
                                        <p className="font-serif text-sm text-gray-700">{movie.budget.toLocaleString('fr-FR')} $</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLONNE DROITE */}
                    <div className="min-w-0">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-600 mb-4 wrap-break-word">
                            {movie.title}
                        </h1>
                        
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6 font-serif text-sm md:text-base text-gray-600">
                            <span>{new Date(movie.release_date).getFullYear()}</span>
                            <span>•</span>
                            <span>{movie.runtime} min</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <span className="text-yellow-600">★</span>
                                {movie.vote_average.toFixed(1)}
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
                            {movie.overview}
                        </p>

                        <div className="mb-6">
                            <h3 className="font-display text-xl uppercase tracking-wider text-gray-600 mb-2">Genres</h3>
                            <div className="flex flex-wrap gap-2">
                                {movie.genres.map(g => (
                                    <span key={g.id} className="font-display text-sm uppercase tracking-wider text-gray-700 bg-gray-200 px-3 py-1 border border-gray-400">
                                        {g.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        {/* Traductions disponibles */}
                        {movie.translations && movie.translations.translations && movie.translations.translations.length > 0 && (
                            <div className="mb-8">
                                <h3 className="font-display text-xl uppercase tracking-wider text-gray-600 mb-2">Traductions Disponibles</h3>
                                <div className="flex flex-wrap gap-2">
                                    {movie.translations.translations.slice(0, 15).map((trans, idx) => (
                                        <span key={idx} className="text-sm font-display uppercase tracking-wider text-gray-500 bg-gray-200 px-3 py-1 border border-gray-400">
                                            {trans.iso_639_1.toUpperCase()}
                                        </span>
                                    ))}
                                    {movie.translations.translations.length > 15 && (
                                        <span className="text-sm font-display text-gray-500">+{movie.translations.translations.length - 15}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {movie.credits && movie.credits.cast && (
                            <div className="mb-8">
                                <h3 className="font-display text-2xl uppercase tracking-wider text-gray-600 mb-4">Casting</h3>
                                <div className="flex gap-4 overflow-x-auto pb-4">
                                    {movie.credits.cast.slice(0, 10).map(actor => (
                                        <Link 
                                            key={actor.id} 
                                            to={`/person/${actor.id}`}
                                            className="shrink-0 w-32 group cursor-pointer"
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
                        
                        {/* Réalisateur et équipe */}
                        {movie.credits && movie.credits.crew && (
                            <div className="mb-8">
                                <h3 className="font-display text-2xl uppercase tracking-wider text-gray-600 mb-4">Équipe</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {movie.credits.crew
                                        .filter(c => ['Director', 'Writer', 'Screenplay', 'Producer'].includes(c.job))
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

                {movie.similar && movie.similar.results.length > 0 && (
                    <section className="mb-12 md:mb-16">
                        <h2 className="text-3xl md:text-4xl font-display uppercase tracking-wider text-gray-600 mb-6 md:mb-8">
                            <span className="text-4xl md:text-5xl text-gray-800">F</span>ilms similaires
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-8">
                            {movie.similar.results.slice(0, 5).map(similar => (
                                <MediaCard key={similar.id} item={similar} type="movie" />
                            ))}
                        </div>
                    </section>
                )}

                {/* Critiques TMDB */}
                {movie.reviews && movie.reviews.results && movie.reviews.results.length > 0 && (
                    <section className="mb-16">
                        <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-gray-600 mb-8 wrap-break-word">
                            <span className="text-4xl sm:text-5xl text-gray-800">C</span>ritiques TMDB
                        </h2>
                        <div className="space-y-6">
                            {movie.reviews.results.slice(0, 5).map((review) => {
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
                                            <div className="shrink-0">
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
                    <h2 className="text-3xl sm:text-4xl font-display uppercase tracking-wider text-gray-600 mb-8 wrap-break-word">
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
            
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default MovieDetail;
