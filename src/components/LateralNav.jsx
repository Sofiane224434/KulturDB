import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { tmdbService } from '../services/tmdb';
import { readingApi } from '../services/readingApi';
import { useAuth } from '../context/AuthContext';

function LateralNav() {
    const { isAdmin } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchFilter, setSearchFilter] = useState('all');
    const [searchHistory, setSearchHistory] = useState([]);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    const searchRef = useRef(null);
    const searchInputRef = useRef(null);

    const searchFilterButtons = [
        { key: 'all', label: 'Tous' },
        { key: 'movie', label: 'Films' },
        { key: 'tv', label: 'Séries' },
        { key: 'anime', label: 'Anime' },
        { key: 'manga', label: 'Manga' },
        { key: 'manwha', label: 'Manwha' },
        { key: 'light_novel', label: 'Light Novel' },
        { key: 'roman', label: 'Roman' },
    ];

    const mediaTypeLabel = {
        movie: 'Film',
        tv: 'Série',
        anime: 'Anime',
        manga: 'Manga',
        manwha: 'Manwha',
        light_novel: 'Light Novel',
        roman: 'Roman',
    };

    // Fermer le drawer au changement de route
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Empecher le scroll du body quand le drawer est ouvert
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    const mainLinks = [
        { name: 'Accueil', path: '/' },
        { name: 'Ma Bibliothèque', path: '/library' },
        { name: 'Mon profil', path: '/profile' },
        { name: 'Parametres', path: '/settings' },
        { name: 'Planning', path: '/planning' },
        { name: 'Films', path: '/movies' },
        { name: 'Séries', path: '/series' },
        { name: 'Anime', path: '/anime' },
        { name: 'Mangas', path: '/manga' },
        { name: 'Manwha', path: '/manwha' },
        { name: 'Light Novels', path: '/light-novels' },
        { name: 'Romans', path: '/romans' },
        ...(isAdmin ? [{ name: 'Admin fiches', path: '/admin/media' }] : []),
    ];

    // Charger l'historique
    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        setSearchHistory(history);
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('kulturdb_sidebar_collapsed');
        setDesktopCollapsed(stored === '1');
    }, []);

    const toggleDesktopSidebar = () => {
        const nextValue = !desktopCollapsed;
        setDesktopCollapsed(nextValue);
        localStorage.setItem('kulturdb_sidebar_collapsed', nextValue ? '1' : '0');
    };

    // Raccourci clavier Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Recherche
    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                try {
                    let data;
                    if (searchFilter === 'movie') {
                        const movieData = await tmdbService.searchMovies(searchQuery);
                        data = {
                            results: (movieData.results || []).map((item) => ({ ...item, media_type: 'movie' }))
                        };
                    } else if (searchFilter === 'tv') {
                        const seriesData = await tmdbService.searchSeries(searchQuery);
                        data = {
                            results: (seriesData.results || []).map((item) => ({ ...item, media_type: 'tv' }))
                        };
                    } else if (searchFilter === 'anime') {
                        // Recherche d'animes (séries d'animation japonaise)
                        const tvData = await tmdbService.searchSeries(searchQuery);
                        data = {
                            results: tvData.results
                                .filter(item => item.origin_country && item.origin_country.includes('JP'))
                                .map((item) => ({ ...item, media_type: 'anime' }))
                        };
                    } else if (searchFilter === 'manga') {
                        const readingData = await readingApi.searchMangas(searchQuery);
                        data = {
                            results: (readingData.results || []).map((item) => ({ ...item, media_type: 'manga' }))
                        };
                    } else if (searchFilter === 'manwha') {
                        const readingData = await readingApi.searchManwha(searchQuery);
                        data = {
                            results: (readingData.results || []).map((item) => ({ ...item, media_type: 'manwha' }))
                        };
                    } else if (searchFilter === 'light_novel') {
                        const readingData = await readingApi.searchLightNovels(searchQuery);
                        data = {
                            results: (readingData.results || []).map((item) => ({ ...item, media_type: 'light_novel' }))
                        };
                    } else if (searchFilter === 'roman') {
                        const readingData = await readingApi.searchRomans(searchQuery);
                        data = {
                            results: (readingData.results || []).map((item) => ({ ...item, media_type: 'roman' }))
                        };
                    } else {
                        data = await tmdbService.searchMulti(searchQuery);
                    }
                    const resultItems = Array.isArray(data?.results) ? data.results : [];
                    setSuggestions(resultItems.slice(0, 5));
                    setShowSuggestions(true);
                } catch (error) {
                    console.error('Erreur de recherche:', error);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(searchTimeout);
    }, [searchQuery, searchFilter]);

    const handleSuggestionClick = (item) => {
        const label = item.title || item.name;
        const mediaType = item.media_type;
        const newHistory = [label, ...searchHistory.filter(h => h !== label)].slice(0, 5);
        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));

        if (mediaType === 'movie') {
            navigate(`/movie/${item.id}`);
        } else if (mediaType === 'tv' || mediaType === 'anime') {
            navigate(`/series/${item.id}`);
        } else if (mediaType === 'manga' || mediaType === 'manwha' || mediaType === 'light_novel' || mediaType === 'roman') {
            navigate(`/reading/${mediaType}/${item.id}`);
        } else {
            navigate(`/series/${item.id}`);
        }

        setSearchQuery('');
        setShowSuggestions(false);
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('searchHistory');
    };

    const navContent = (
        <>
            <Link to="/">
                <div className="p-3 flex flex-col items-center gap-2 cursor-pointer group">
                    <span className="flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg group-hover:scale-105 transition-transform">
                        <span className="font-display font-bold text-6xl leading-none text-black">K</span>
                    </span>
                    <h3 className="text-2xl font-bold text-gray-400 tracking-widest font-display underline decoration-gray-600 decoration-2 underline-offset-4 group-hover:text-gray-300 transition-colors text-center">
                        <span className="text-3xl">K</span>ULTUR<span className="text-3xl">D</span><span className="text-3xl">B</span>
                    </h3>
                </div>
            </Link>

            <div className="px-3 mb-4" ref={searchRef}>
                <div className="grid grid-cols-4 gap-1 mb-2">
                    {searchFilterButtons.map((filterButton) => (
                        <button
                            key={filterButton.key}
                            onClick={() => setSearchFilter(filterButton.key)}
                            className={`px-1 py-0.5 text-[11px] font-display uppercase tracking-wider transition-colors ${searchFilter === filterButton.key ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}
                        >
                            {filterButton.label}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Rechercher (Ctrl+K)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-gray-300 text-sm font-serif focus:outline-none focus:border-gray-500 transition-colors"
                    />
                    {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 max-h-96 overflow-y-auto z-50">
                            {suggestions.length > 0 ? (
                                suggestions.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSuggestionClick(item)}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.poster_path && (
                                                <img
                                                    src={tmdbService.getImageUrl(item.poster_path, 'w92')}
                                                    alt={item.title || item.name}
                                                    className="w-8 h-12 object-cover"
                                                />
                                            )}
                                            {!item.poster_path && item.image && (
                                                <img
                                                    src={item.image}
                                                    alt={item.title || item.name}
                                                    className="w-8 h-12 object-cover"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-display text-gray-300 text-xs uppercase tracking-wider truncate">
                                                    {item.title || item.name}
                                                </p>
                                                <p className="font-serif text-xs text-gray-500">
                                                    {mediaTypeLabel[item.media_type] || 'Résultat'} • {item.release_date || item.first_air_date ? new Date(item.release_date || item.first_air_date).getFullYear() : (item.year || 'N/A')}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            ) : searchQuery.length >= 2 ? (
                                <div className="px-3 py-2 text-gray-500 font-serif text-xs">Aucun résultat</div>
                            ) : null}

                            {searchHistory.length > 0 && searchQuery.length < 2 && (
                                <>
                                    <div className="px-3 py-2 flex justify-between items-center border-t border-gray-800">
                                        <span className="text-xs uppercase tracking-wider text-gray-600 font-display">Historique</span>
                                        <button onClick={clearHistory} className="text-xs text-gray-500 hover:text-gray-300 font-serif">Effacer</button>
                                    </div>
                                    {searchHistory.map((term, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setSearchQuery(term)}
                                            className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                                        >
                                            <p className="font-serif text-gray-400 text-xs">🕒 {term}</p>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 flex-1 p-3 gap-1 content-start auto-rows-min">

                {mainLinks.map((link) => (
                    <li key={link.path}>
                        <Link
                            to={link.path}
                            className={`block py-1.5 px-2.5 text-sm font-display uppercase tracking-wider transition-all border-l-2 ${(`${location.pathname}${location.search}` === link.path || location.pathname === link.path)
                                    ? 'text-gray-300 bg-gray-900 border-gray-500'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-transparent hover:border-gray-500'
                                }`}
                        >
                            {link.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );

    return (
        <>
            {/* Barre top mobile */}
            <div className="md:hidden sticky top-0 z-40 bg-black border-b border-gray-800 flex items-center justify-between px-4 py-3 order-1">
                <Link to="/" className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-9 h-9 bg-white rounded-lg shadow-md">
                        <span className="font-display font-bold text-2xl leading-none text-black">K</span>
                    </span>
                    <span className="text-lg font-bold text-gray-300 tracking-widest font-display">
                        ULTUR<span className="text-xl">DB</span>
                    </span>
                </Link>
                <button
                    onClick={() => setMobileOpen(true)}
                    aria-label="Ouvrir le menu"
                    className="text-gray-300 p-2"
                >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Overlay mobile */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <nav
                className={`md:hidden bg-black z-50 border-l-2 border-black fixed top-0 right-0 h-full w-72 max-w-[85vw] transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Bouton fermer mobile */}
                <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fermer le menu"
                    className="md:hidden absolute top-3 right-3 text-gray-400 p-2 z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
                    {navContent}
                </div>
            </nav>

            <aside className={`hidden md:block md:order-2 md:sticky md:top-0 md:h-screen md:self-start bg-black border-l-2 border-black transition-all duration-300 ${desktopCollapsed ? 'md:w-14 lg:w-14' : 'md:w-75 lg:w-80'}`}>
                <div className="flex items-center justify-between px-2 py-2 border-b border-gray-800">
                    {!desktopCollapsed ? (
                        <Link
                            to="/friends"
                            aria-label="Gerer les amis"
                            className={`w-7 h-7 flex items-center justify-center border text-[10px] font-display uppercase tracking-wider ${location.pathname === '/friends' ? 'border-gray-400 text-gray-200 bg-gray-800' : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}
                        >
                            A
                        </Link>
                    ) : <span className="w-7 h-7" aria-hidden="true"></span>}
                    <button
                        onClick={toggleDesktopSidebar}
                        aria-label={desktopCollapsed ? 'Ouvrir la sidebar' : 'Replier la sidebar'}
                        className="px-1.5 py-0.5 text-[11px] font-display uppercase tracking-wider text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-500"
                    >
                        {desktopCollapsed ? '>>' : '<<'}
                    </button>
                </div>

                <div className={`h-full overflow-y-auto no-scrollbar ${desktopCollapsed ? 'hidden' : 'flex flex-col'}`}>
                    {navContent}
                </div>
            </aside>
        </>
    );
}

export default LateralNav;