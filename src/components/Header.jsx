import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { tmdbService } from '../services/tmdb';

function Header() {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchFilter, setSearchFilter] = useState('all'); // all, movie, tv
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [searchHistory, setSearchHistory] = useState([]);
    const searchRef = useRef(null);
    const searchInputRef = useRef(null);
    const navigate = useNavigate();

    // Charger l'historique de recherche au montage
    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        setSearchHistory(history);
    }, []);

    // Charger l'historique de recherche au montage
    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        setSearchHistory(history);
    }, []);

    // Raccourci clavier Ctrl+K pour focus sur recherche
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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                try {
                    let data;
                    if (searchFilter === 'movie') {
                        data = await tmdbService.searchMovies(searchQuery);
                    } else if (searchFilter === 'tv') {
                        data = await tmdbService.searchSeries(searchQuery);
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

        // Ajouter à l'historique
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

    return (
        <header className="bg-black border-b-2 border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between gap-8">
                    <Link to="/" className="font-display text-3xl uppercase tracking-widest text-gray-400 hover:text-gray-300 transition-colors">
                        <span className="text-4xl">K</span>ultur<span className="text-4xl">D</span><span className="text-4xl">B</span>
                    </Link>

                    <nav className="hidden md:flex gap-6">
                        <Link to="/" className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Accueil
                        </Link>
                        <Link to="/movies" className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Films
                        </Link>
                        <Link to="/series" className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Séries
                        </Link>
                        <Link to="/anime" className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Anime
                        </Link>
                        <Link to="/manga" className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Mangas
                        </Link>
                        <Link to="/profile" className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Mon profil
                        </Link>
                    </nav>

                    <div className="relative flex-1 max-w-xl" ref={searchRef}>
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setSearchFilter('all')}
                                className={`px-3 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'all' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => setSearchFilter('movie')}
                                className={`px-3 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'movie' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Films
                            </button>
                            <button
                                onClick={() => setSearchFilter('tv')}
                                className={`px-3 py-1 text-xs font-display uppercase tracking-wider transition-colors ${searchFilter === 'tv' ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                Séries
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Rechercher... (Ctrl+K)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 text-gray-300 font-serif focus:outline-none focus:border-gray-500 transition-colors"
                            />
                            {showSuggestions && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 max-h-96 overflow-y-auto z-50">
                                    {suggestions.length > 0 ? (
                                        suggestions.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleSuggestionClick(item)}
                                                className="w-full px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {item.poster_path && (
                                                        <img
                                                            src={tmdbService.getImageUrl(item.poster_path, 'w92')}
                                                            alt={item.title || item.name}
                                                            className="w-12 h-16 object-cover"
                                                        />
                                                    )}
                                                    <div>
                                                        <p className="font-display text-gray-300 text-sm uppercase tracking-wider">
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
                                        <div className="px-4 py-3 text-gray-500 font-serif text-sm">Aucun résultat trouvé</div>
                                    ) : null}

                                    {searchHistory.length > 0 && searchQuery.length < 2 && (
                                        <>
                                            <div className="px-4 py-2 flex justify-between items-center border-t border-gray-800">
                                                <span className="text-xs uppercase tracking-wider text-gray-600 font-display">Historique</span>
                                                <button onClick={clearHistory} className="text-xs text-gray-500 hover:text-gray-300 font-serif">Effacer</button>
                                            </div>
                                            {searchHistory.map((term, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setSearchQuery(term)}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                                                >
                                                    <p className="font-serif text-gray-400 text-sm">🕒 {term}</p>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Menu Mobile */}
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="md:hidden text-gray-400 hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>

                {/* Menu Mobile Dropdown */}
                {showMobileMenu && (
                    <nav className="md:hidden mt-4 pt-4 border-t border-gray-800 flex flex-col gap-3">
                        <Link to="/" onClick={() => setShowMobileMenu(false)} className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Accueil
                        </Link>
                        <Link to="/movies" onClick={() => setShowMobileMenu(false)} className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Films
                        </Link>
                        <Link to="/series" onClick={() => setShowMobileMenu(false)} className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Séries
                        </Link>
                        <Link to="/anime" onClick={() => setShowMobileMenu(false)} className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Anime
                        </Link>
                        <Link to="/manga" onClick={() => setShowMobileMenu(false)} className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Mangas
                        </Link>
                        <Link to="/profile" onClick={() => setShowMobileMenu(false)} className="font-display uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors">
                            Mon profil
                        </Link>
                    </nav>
                )}
            </div>
        </header>
    );
}

export default Header;
