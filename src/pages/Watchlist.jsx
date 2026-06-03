import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWatchlist } from '../hooks/useLocalStorage';
import { tmdbService } from '../services/tmdb';

function Watchlist() {
    const { getWatchlist, removeFromWatchlist, updateWatchlistStatus, updateWatchlistItem, addManualEntry } = useWatchlist();
    const [searchParams] = useSearchParams();
    const [watchlist, setWatchlist] = useState([]);
    const [filter, setFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [newEntry, setNewEntry] = useState({
        title: '',
        type: 'manga',
        status: 'to_start',
        progressCurrent: 0,
        progressTotal: '',
        progressUnit: 'chapitre',
        scanAvailable: true,
        imdbRating: '',
        personalRating: 0,
        personalNote: '',
        publicComment: '',
    });

    useEffect(() => {
        setWatchlist(getWatchlist());
    }, []);

    useEffect(() => {
        const fromQuery = searchParams.get('type');
        if (fromQuery && ['movie', 'series', 'anime', 'manga', 'manwha', 'light_novel', 'roman'].includes(fromQuery)) {
            setTypeFilter(fromQuery);
        }
    }, [searchParams]);

    const handleRemove = (id, type) => {
        const updated = removeFromWatchlist(id, type);
        setWatchlist(updated);
    };

    const handleStatusChange = (id, type, status) => {
        const updated = updateWatchlistStatus(id, status, type);
        setWatchlist(updated);
    };

    const handleMetaChange = (id, type, patch) => {
        const updated = updateWatchlistItem(id, patch, type);
        setWatchlist(updated);
    };

    const handleAddManual = (e) => {
        e.preventDefault();
        if (!newEntry.title.trim()) {
            return;
        }

        const updated = addManualEntry({
            ...newEntry,
            title: newEntry.title.trim(),
            progressTotal: newEntry.progressTotal ? Number(newEntry.progressTotal) : null,
            imdbRating: newEntry.imdbRating ? Number(newEntry.imdbRating) : null,
            personalRating: Number(newEntry.personalRating) || 0,
            hasSeen: newEntry.status === 'completed',
            wantRewatch: newEntry.status === 'rewatch',
        });

        setWatchlist(updated);
        setNewEntry({
            title: '',
            type: 'manga',
            status: 'to_start',
            progressCurrent: 0,
            progressTotal: '',
            progressUnit: 'chapitre',
            scanAvailable: true,
            imdbRating: '',
            personalRating: 0,
            personalNote: '',
            publicComment: '',
        });
    };

    const filteredList = watchlist.filter((item) => {
        const statusOk = filter === 'all' || item.status === filter;
        const typeOk = typeFilter === 'all' || item.type === typeFilter;
        return statusOk && typeOk;
    });

    const getStatusLabel = (status) => {
        switch(status) {
            case 'to_start': return 'À voir / à lire';
            case 'in_progress': return 'En cours';
            case 'completed': return 'Déjà vu / lu';
            case 'rewatch': return 'À revoir / relire';
            default: return 'À voir / à lire';
        }
    };

    const typeLabels = {
        movie: 'Film',
        series: 'Série',
        anime: 'Anime',
        manga: 'Manga',
        manwha: 'Manwha',
        light_novel: 'Light Novel',
        roman: 'Roman',
    };

    const getPreferredRating = (item) => {
        if (item.imdbRating && Number(item.imdbRating) > 0) {
            return { source: 'IMDb', value: Number(item.imdbRating).toFixed(1), scale: '/10' };
        }
        if (item.vote_average && Number(item.vote_average) > 0) {
            return { source: 'TMDB', value: Number(item.vote_average).toFixed(1), scale: '/10' };
        }
        return null;
    };

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6 md:mb-8">
                    <span className="text-5xl sm:text-6xl md:text-7xl text-gray-800">B</span>ase Mangas, Romans et Lectures
                </h1>

                <form onSubmit={handleAddManual} className="mb-6 md:mb-8 border-2 border-gray-300 bg-white p-4 md:p-6">
                    <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-4">Ajouter Manga / Manwha / Light Novel / Roman</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <input
                            type="text"
                            placeholder="Titre"
                            value={newEntry.title}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, title: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif"
                            required
                        />
                        <select
                            value={newEntry.type}
                            onChange={(e) => {
                                const nextType = e.target.value;
                                const nextUnit = nextType === 'roman' ? 'page' : 'chapitre';
                                setNewEntry((prev) => ({ ...prev, type: nextType, progressUnit: nextUnit }));
                            }}
                            className="border border-gray-400 px-3 py-2 font-serif"
                        >
                            <option value="manga">Manga</option>
                            <option value="manwha">Manwha</option>
                            <option value="light_novel">Light Novel</option>
                            <option value="roman">Roman</option>
                        </select>
                        <select
                            value={newEntry.status}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, status: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif"
                        >
                            <option value="to_start">À voir / à lire</option>
                            <option value="in_progress">En cours</option>
                            <option value="completed">Déjà vu / lu</option>
                            <option value="rewatch">À revoir / relire</option>
                        </select>
                        <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            placeholder="Note IMDb (optionnel)"
                            value={newEntry.imdbRating}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, imdbRating: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif"
                        />
                        <input
                            type="number"
                            min="0"
                            placeholder="Progression actuelle"
                            value={newEntry.progressCurrent}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, progressCurrent: Number(e.target.value || 0) }))}
                            className="border border-gray-400 px-3 py-2 font-serif"
                        />
                        <input
                            type="number"
                            min="0"
                            placeholder="Total (optionnel)"
                            value={newEntry.progressTotal}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, progressTotal: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif"
                        />
                        <select
                            value={newEntry.progressUnit}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, progressUnit: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif"
                        >
                            <option value="chapitre">Chapitre</option>
                            <option value="tome">Tome</option>
                            <option value="page">Page</option>
                        </select>
                        <label className="flex items-center gap-2 font-serif text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={newEntry.scanAvailable}
                                onChange={(e) => setNewEntry((prev) => ({ ...prev, scanAvailable: e.target.checked }))}
                            />
                            Scan disponible
                        </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <textarea
                            placeholder="Appréciation personnelle"
                            value={newEntry.personalNote}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, personalNote: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif min-h-20"
                        />
                        <textarea
                            placeholder="Commentaire public (avis communautaire)"
                            value={newEntry.publicComment}
                            onChange={(e) => setNewEntry((prev) => ({ ...prev, publicComment: e.target.value }))}
                            className="border border-gray-400 px-3 py-2 font-serif min-h-20"
                        />
                    </div>
                    <button
                        type="submit"
                        className="mt-3 px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider"
                    >
                        Ajouter à la bibliothèque
                    </button>
                </form>

                <div className="flex flex-wrap gap-2 md:gap-4 mb-6 md:mb-8">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 md:px-6 py-2 text-xs md:text-base font-display uppercase tracking-wider border-2 border-gray-800 transition-colors ${
                            filter === 'all' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 hover:bg-gray-800 hover:text-gray-300'
                        }`}
                    >
                        Tous ({watchlist.length})
                    </button>
                    <button
                        onClick={() => setFilter('to_start')}
                        className={`px-3 md:px-6 py-2 text-xs md:text-base font-display uppercase tracking-wider border-2 border-gray-800 transition-colors ${
                            filter === 'to_start' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 hover:bg-gray-800 hover:text-gray-300'
                        }`}
                    >
                        À voir / lire ({watchlist.filter(i => i.status === 'to_start').length})
                    </button>
                    <button
                        onClick={() => setFilter('in_progress')}
                        className={`px-3 md:px-6 py-2 text-xs md:text-base font-display uppercase tracking-wider border-2 border-gray-800 transition-colors ${
                            filter === 'in_progress' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 hover:bg-gray-800 hover:text-gray-300'
                        }`}
                    >
                        En cours ({watchlist.filter(i => i.status === 'in_progress').length})
                    </button>
                    <button
                        onClick={() => setFilter('completed')}
                        className={`px-3 md:px-6 py-2 text-xs md:text-base font-display uppercase tracking-wider border-2 border-gray-800 transition-colors ${
                            filter === 'completed' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 hover:bg-gray-800 hover:text-gray-300'
                        }`}
                    >
                        Déjà vu / lu ({watchlist.filter(i => i.status === 'completed').length})
                    </button>
                    <button
                        onClick={() => setFilter('rewatch')}
                        className={`px-3 md:px-6 py-2 text-xs md:text-base font-display uppercase tracking-wider border-2 border-gray-800 transition-colors ${
                            filter === 'rewatch' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 hover:bg-gray-800 hover:text-gray-300'
                        }`}
                    >
                        Revoir / relire ({watchlist.filter(i => i.status === 'rewatch').length})
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 md:gap-4 mb-6 md:mb-8">
                    {['all', 'movie', 'series', 'anime', 'manga', 'manwha', 'light_novel', 'roman'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(type)}
                            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-display uppercase tracking-wider border border-gray-500 transition-colors ${
                                typeFilter === type ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {type === 'all' ? 'Tous types' : typeLabels[type]}
                        </button>
                    ))}
                </div>

                {filteredList.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-2xl font-display uppercase tracking-wider text-gray-600 mb-4">
                            Aucun élément dans cette catégorie
                        </p>
                        <p className="font-serif text-gray-600">
                            Commencez à enrichir votre base de lecture
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {filteredList.map((item) => {
                            const preferredRating = getPreferredRating(item);
                            const posterUrl = item.poster_path ? tmdbService.getImageUrl(item.poster_path, 'w500') : null;
                            const isTmdbType = ['movie', 'series', 'anime'].includes(item.type);
                            const detailPath = item.type === 'anime' ? `/series/${item.id}` : `/${item.type}/${item.id}`;
                            const title = item.title || item.name || 'Sans titre';

                            return (
                                <div key={`${item.type}-${item.id}`} className="group border border-gray-300 bg-white p-3">
                                    {isTmdbType ? (
                                        <Link to={detailPath} className="block mb-3">
                                            {posterUrl ? (
                                                <div className="relative overflow-hidden border-4 border-gray-800 transition-transform hover:scale-105">
                                                    <img 
                                                        src={posterUrl} 
                                                        alt={title} 
                                                        className="w-full aspect-[2/3] object-cover grayscale hover:grayscale-0 transition-all"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="border-4 border-gray-800">
                                                    <div className="w-full aspect-[2/3] bg-gray-300 flex items-center justify-center">
                                                        <span className="text-gray-500 text-4xl">?</span>
                                                    </div>
                                                </div>
                                            )}
                                        </Link>
                                    ) : (
                                        <div className="mb-3 border-4 border-gray-800 bg-gray-100 aspect-[2/3] flex flex-col items-center justify-center px-3 text-center">
                                            <p className="font-display text-lg uppercase tracking-wider text-gray-700">{typeLabels[item.type] || 'Oeuvre'}</p>
                                            {item.scanAvailable && (
                                                <p className="mt-2 text-xs font-serif text-gray-600">Scan disponible</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    <h3 className="font-display text-sm uppercase tracking-wider text-gray-700 mb-1">
                                        {title}
                                    </h3>
                                    <p className="text-xs font-serif text-gray-500 mb-2">{typeLabels[item.type] || item.type}</p>

                                    {preferredRating && (
                                        <p className="text-xs font-serif text-gray-700 mb-2">
                                            Note prioritaire {preferredRating.source}: <span className="font-semibold">{preferredRating.value}{preferredRating.scale}</span>
                                        </p>
                                    )}

                                    <select
                                        value={item.status || 'to_start'}
                                        onChange={(e) => handleStatusChange(item.id, item.type, e.target.value)}
                                        className="w-full mb-2 px-2 py-1 text-xs font-serif border border-gray-800 bg-white text-gray-700 focus:outline-none focus:border-gray-600"
                                    >
                                        <option value="to_start">À voir / lire</option>
                                        <option value="in_progress">En cours</option>
                                        <option value="completed">Déjà vu / lu</option>
                                        <option value="rewatch">À revoir / relire</option>
                                    </select>

                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.progressCurrent ?? 0}
                                            onChange={(e) => handleMetaChange(item.id, item.type, { progressCurrent: Number(e.target.value || 0) })}
                                            className="px-2 py-1 text-xs font-serif border border-gray-400"
                                            placeholder="Actuel"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.progressTotal ?? ''}
                                            onChange={(e) => handleMetaChange(item.id, item.type, { progressTotal: e.target.value ? Number(e.target.value) : null })}
                                            className="px-2 py-1 text-xs font-serif border border-gray-400"
                                            placeholder="Total"
                                        />
                                    </div>

                                    <input
                                        type="text"
                                        value={item.progressUnit || ''}
                                        onChange={(e) => handleMetaChange(item.id, item.type, { progressUnit: e.target.value || 'episode' })}
                                        className="w-full mb-2 px-2 py-1 text-xs font-serif border border-gray-400"
                                        placeholder="Unité (épisode, chapitre...)"
                                    />

                                    <div className="flex items-center gap-3 mb-2 text-xs font-serif text-gray-700">
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(item.hasSeen)}
                                                onChange={(e) => handleMetaChange(item.id, item.type, { hasSeen: e.target.checked })}
                                            />
                                            Déjà vu / lu
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(item.wantRewatch)}
                                                onChange={(e) => handleMetaChange(item.id, item.type, { wantRewatch: e.target.checked })}
                                            />
                                            Revoir / relire
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.5"
                                            value={item.personalRating ?? 0}
                                            onChange={(e) => handleMetaChange(item.id, item.type, { personalRating: Number(e.target.value || 0) })}
                                            className="px-2 py-1 text-xs font-serif border border-gray-400"
                                            placeholder="Note perso /5"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.1"
                                            value={item.imdbRating ?? ''}
                                            onChange={(e) => handleMetaChange(item.id, item.type, { imdbRating: e.target.value ? Number(e.target.value) : null })}
                                            className="px-2 py-1 text-xs font-serif border border-gray-400"
                                            placeholder="IMDb /10"
                                        />
                                    </div>

                                    <textarea
                                        value={item.personalNote || ''}
                                        onChange={(e) => handleMetaChange(item.id, item.type, { personalNote: e.target.value })}
                                        className="w-full mb-2 px-2 py-1 text-xs font-serif border border-gray-400 min-h-16"
                                        placeholder="Appréciation personnelle"
                                    />

                                    <textarea
                                        value={item.publicComment || ''}
                                        onChange={(e) => handleMetaChange(item.id, item.type, { publicComment: e.target.value })}
                                        className="w-full mb-2 px-2 py-1 text-xs font-serif border border-gray-400 min-h-16"
                                        placeholder="Commentaire public"
                                    />

                                    <p className="text-xs font-serif text-gray-500 mb-2">
                                        Statut actuel: {getStatusLabel(item.status)}
                                    </p>

                                    <button
                                        onClick={() => handleRemove(item.id, item.type)}
                                        className="w-full px-2 py-1 text-xs font-display uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 transition-colors"
                                    >
                                        Retirer
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default Watchlist;
