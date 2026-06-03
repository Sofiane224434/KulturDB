import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tmdbService } from '../services/tmdb';
import { resolveSeriesAnimeMetadata, useLibrary } from '../hooks/useLocalStorage';
import { useUiPreferences } from '../context/UiPreferencesContext';

// Mapping des genres
const GENRES = {
    28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime',
    99: 'Documentaire', 18: 'Drame', 10751: 'Familial', 14: 'Fantasy', 36: 'Histoire',
    27: 'Horreur', 10402: 'Musique', 9648: 'Mystère', 10749: 'Romance', 878: 'Science-Fiction',
    10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
    10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

function MediaCard({ item, type }) {
    const { isInLibrary, addToLibrary } = useLibrary();
    const { preferences } = useUiPreferences();
    const posterUrl = tmdbService.getImageUrl(item.poster_path, 'w342');
    const title = type === 'movie' ? item.title : item.name;
    const releaseDate = type === 'movie' ? item.release_date : item.first_air_date;
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
    const detailUrl = type === 'movie' ? `/movie/${item.id}` : `/series/${item.id}`;
    const [inLibraryState, setInLibraryState] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    
    // Récupérer les 2 premiers genres
    const genres = item.genre_ids?.slice(0, 2).map(id => GENRES[id]).filter(Boolean) || [];

    useEffect(() => {
        if (type === 'series') {
            setInLibraryState(isInLibrary(item.id, 'series') || isInLibrary(item.id, 'anime'));
            return;
        }

        setInLibraryState(isInLibrary(item.id, type));
    }, [item.id, isInLibrary, type]);

    const handleQuickAdd = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (inLibraryState || isAdding) {
            return;
        }

        setIsAdding(true);

        let nextType = type;
        let progressTotal = type === 'movie' ? 1 : null;
        let seasonBreakdown = [];
        let runtimeMinutes = null;
        let episodeRuntimeMinutes = null;

        if (type === 'movie') {
            try {
                const details = await tmdbService.getMovieDetails(item.id);
                if (Number.isFinite(details?.runtime) && details.runtime > 0) {
                    runtimeMinutes = details.runtime;
                }
            } catch (_error) {
                // Fallback silencieux: l'ajout reste possible sans duree exacte.
            }
        }

        if (type === 'series' || type === 'anime') {
            try {
                const resolved = await resolveSeriesAnimeMetadata({
                    id: item.id,
                    preferredType: type,
                    title,
                    year: releaseYear !== 'N/A' ? releaseYear : null,
                });

                nextType = resolved.type;
                progressTotal = resolved.progressTotal;
                seasonBreakdown = resolved.seasonBreakdown;
                episodeRuntimeMinutes = resolved.episodeRuntimeMinutes;
            } catch (error) {
                // Fallback silencieux: on conserve un ajout minimal si le détail série échoue.
            }
        }

        try {
            addToLibrary(
                {
                    id: item.id,
                    title,
                    poster_path: item.poster_path,
                    year: releaseYear !== 'N/A' ? releaseYear : null,
                    source: 'TMDB',
                },
                nextType,
                {
                    progressUnit: nextType === 'movie' ? 'film' : 'episode',
                    progressTotal,
                    seasonBreakdown,
                    runtimeMinutes,
                    episodeRuntimeMinutes,
                    metadataSyncedAt: Date.now(),
                },
            );
            setInLibraryState(true);
        } finally {
            setIsAdding(false);
        }
    };
    
    return (
        <div className="relative group">
            <Link to={detailUrl} className="block">
            <article className="cursor-pointer">
                <div className="relative overflow-hidden border-2 border-gray-800 bg-black">
                    {posterUrl ? (
                        <img 
                            src={posterUrl} 
                            alt={title}
                            className={`w-full aspect-2/3 object-cover transition-all duration-500 ${preferences.showCardColors ? 'group-hover:scale-[1.01]' : 'grayscale group-hover:grayscale-0'}`}
                        />
                    ) : (
                        <div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center">
                            <span className="text-gray-600 text-4xl font-display">?</span>
                        </div>
                    )}
                    
                    {/* Badge de note TMDB */}
                    {item.vote_average > 0 && (
                        <div className="absolute top-2 right-2 bg-black/80 border border-gray-700 px-2 py-1">
                            <span className="text-yellow-500 font-display text-sm">★ {item.vote_average.toFixed(1)}</span>
                        </div>
                    )}
                </div>
                
                <div className="mt-3 px-2">
                    <h3 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-1 line-clamp-1">
                        {title}
                    </h3>
                    <p className="font-serif text-sm text-gray-500 mb-1">{releaseYear}</p>
                    {genres.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                            {genres.map((genre, idx) => (
                                <span key={idx} className="text-xs font-display uppercase tracking-wider text-gray-400 bg-gray-200 px-2 py-0.5">
                                    {genre}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </article>
            </Link>

            <button
                onClick={handleQuickAdd}
                aria-label={inLibraryState ? 'Déjà dans la bibliothèque' : 'Ajouter à ma bibliothèque'}
                disabled={isAdding}
                className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 border-2 font-display text-lg leading-none flex items-center justify-center transition-colors ${inLibraryState ? 'bg-gray-700 text-gray-200 border-gray-900' : 'bg-black text-gray-200 border-gray-800 hover:text-white'}`}
            >
                {inLibraryState ? '✓' : '+'}
            </button>
        </div>
    );
}

export default MediaCard;
