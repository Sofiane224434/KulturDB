import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { tmdbService } from '../services/tmdb';
import { useAuth } from '../context/AuthContext';

function LateralNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchFilter, setSearchFilter] = useState('all');
    const [searchHistory, setSearchHistory] = useState([]);
    const [mobileOpen, setMobileOpen] = useState(false);
    const searchRef = useRef(null);
    const searchInputRef = useRef(null);

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
        { name: 'Films', path: '/movies' },
        { name: 'Séries', path: '/series' },
        { name: 'Anime', path: '/anime' },
        { name: 'Watchlist', path: '/watchlist' },
        { name: 'Favoris', path: '/favorites' }
    ];

    // Charger l'historique
    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        setSearchHistory(history);
    }, []);

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
                        data = await tmdbService.searchMovies(searchQuery);
                    } else if (searchFilter === 'tv') {
                        data = await tmdbService.searchSeries(searchQuery);
                    } else if (searchFilter === 'anime') {
                        // Recherche d'animes (séries d'animation japonaise)
                        const tvData = await tmdbService.searchSeries(searchQuery);
                        data = {
                            results: tvData.results.filter(item =>
                                item.origin_country && item.origin_country.includes('JP')
                            )
                        };
                    } else {
                        data = await tmdbService.searchMulti(searchQuery);
                    }
                    setSuggestions(data.results.slice(0, 5));
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
        const type = item.media_type === 'movie' ? 'movie' : 'series';
        const newHistory = [item.title || item.name, ...searchHistory.filter(h => h !== (item.title || item.name))].slice(0, 5);
        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
        navigate(`/${type}/${item.id}`);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('searchHistory');
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <>
            {/* Barre top mobile */}
            <div className="md:hidden sticky top-0 z-40 bg-black border-b border-gray-800 flex items-center justify-between px-4 py-3 order-1">
                <Link to="/" className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-9 h-9 bg-white rounded-lg shadow-md">
                        <span className="font-display font-bold text-2xl leading-none text-black">M</span>
                    </span>
                    <span className="text-lg font-bold text-gray-300 tracking-widest font-display">
                        OVIE<span className="text-xl">DB</span>
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
                className={`bg-black z-50 border-l-2 border-black
                    md:w-2/12 md:h-screen md:sticky! md:top-0! md:right-auto! md:self-start md:translate-x-0 md:order-2
                    fixed top-0 right-0 h-full w-72 max-w-[85vw] transform transition-transform duration-300
                    ${mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
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
                <div className="flex flex-col h-full max-h-screen overflow-y-auto no-scrollbar">
                    <Link to="/">
                        <div className="p-4 flex flex-col items-center gap-3 cursor-pointer group">
                            <span className="flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg group-hover:scale-105 transition-transform">
                                <span className="font-display font-bold text-6xl leading-none text-black">M</span>
                            </span>
                            <h3 className="text-2xl font-bold text-gray-400 tracking-widest font-display underline decoration-gray-600 decoration-2 underline-offset-4 group-hover:text-gray-300 transition-colors text-center">
                                <span className="text-3xl">M</span>OVIE<span className="text-3xl">D</span><span className="text-3xl">B</span>
                            </h3>
                        </div>
                    </Link>

                    {/* Barre de recherche */}
                    <div className="px-3 mb-4" ref={searchRef}>
                        <div className="flex gap-1 mb-2">
                            <button
                                onClick={() => setSearchFilter('all')}
                                className={`flex-1 px-1 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'all' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => setSearchFilter('movie')}
                                className={`flex-1 px-1 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'movie' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Films
                            </button>
                            <button
                                onClick={() => setSearchFilter('tv')}
                                className={`flex-1 px-1 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'tv' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Séries
                            </button>
                            <button
                                onClick={() => setSearchFilter('anime')}
                                className={`flex-1 px-1 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'anime' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Anime
                            </button>
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
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-display text-gray-300 text-xs uppercase tracking-wider truncate">
                                                            {item.title || item.name}
                                                        </p>
                                                        <p className="font-serif text-xs text-gray-500">
                                                            {item.media_type === 'movie' ? 'Film' : 'Série'} • {item.release_date || item.first_air_date ? new Date(item.release_date || item.first_air_date).getFullYear() : 'N/A'}
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

                    <ul className="flex flex-col flex-1 p-3 gap-1">
                        <li className="h-4 mb-2 border2-separator"></li>

                        {mainLinks.map((link) => (
                            <li key={link.path}>
                                <Link
                                    to={link.path}
                                    className={`block py-2 px-3 text-base font-display uppercase tracking-widest transition-all border-l-2 ${location.pathname === link.path
                                            ? 'text-gray-300 bg-gray-900 border-gray-500'
                                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-transparent hover:border-gray-500'
                                        }`}
                                >
                                    {link.name}
                                </Link>
                            </li>
                        ))}

                        <li className="h-4 mt-2 border2-separator"></li>

                        {isAuthenticated ? (
                            <>
                                <li className="px-3 py-2 text-xs font-serif text-gray-500 wrap-break-word">
                                    Connecté: <span className="text-gray-300">{user?.displayName || user?.email}</span>
                                </li>
                                <li>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left py-2 px-3 text-base font-display uppercase tracking-widest text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-l-2 border-transparent hover:border-gray-500 transition-all"
                                    >
                                        Déconnexion
                                    </button>
                                </li>
                            </>
                        ) : (
                            <>
                                <li>
                                    <Link
                                        to="/login"
                                        className={`block py-2 px-3 text-base font-display uppercase tracking-widest transition-all border-l-2 ${location.pathname === '/login'
                                                ? 'text-gray-300 bg-gray-900 border-gray-500'
                                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-transparent hover:border-gray-500'
                                            }`}
                                    >
                                        Connexion
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        to="/register"
                                        className={`block py-2 px-3 text-base font-display uppercase tracking-widest transition-all border-l-2 ${location.pathname === '/register'
                                                ? 'text-gray-300 bg-gray-900 border-gray-500'
                                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-transparent hover:border-gray-500'
                                            }`}
                                    >
                                        Inscription
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </nav>
        </>
    );
}

export default LateralNav;