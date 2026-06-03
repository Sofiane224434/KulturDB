import { useState, useEffect } from 'react';
import MediaCard from '../components/MediaCard';
import { tmdbService } from '../services/tmdb';

function Home() {
    const [movies, setMovies] = useState([]);
    const [series, setSeries] = useState([]);
    const [anime, setAnime] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [moviesData, seriesData, animeData] = await Promise.all([
                    tmdbService.getTrendingMovies(),
                    tmdbService.getTrendingSeries(),
                    tmdbService.getAnime()
                ]);
                setMovies(moviesData.results.slice(0, 8));
                setSeries(seriesData.results.slice(0, 8));
                setAnime(animeData.results.slice(0, 8));
            } catch (error) {
                console.error('Erreur:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
                <p className="mt-4 font-display text-2xl text-gray-500 uppercase tracking-widest">Chargement...</p>
            </div>
        );
    }

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            
            <div className="px-3 sm:px-6 md:px-12 py-6 md:py-8">
                <header className="mb-10 md:mb-16 text-center">
                    <h5 className="text-xs sm:text-sm tracking-[0.3em] sm:tracking-[0.5em] uppercase text-gray-600 mb-2">Bienvenue sur</h5>
                    <h1 className="text-4xl sm:text-6xl md:text-8xl font-display uppercase tracking-wider text-gray-500 mb-6 drop-shadow-xl break-words">
                        <span className="text-5xl sm:text-7xl md:text-9xl">K</span>ultur<span className="text-5xl sm:text-7xl md:text-9xl">D</span><span className="text-5xl sm:text-7xl md:text-9xl">B</span>
                    </h1>
                    <div className="h-1 w-24 md:w-32 bg-gray-400 mx-auto mb-6 md:mb-8"></div>
                    <p className="max-w-2xl mx-auto text-base md:text-lg font-serif text-gray-600">
                        Découvrez les films et séries les plus populaires du moment. Explorez, notez et partagez vos favoris.
                    </p>
                </header>

            <section className="mb-12 md:mb-20">
                <div className="mb-6 md:mb-8 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-600">
                        <span className="text-4xl sm:text-5xl md:text-6xl text-gray-800">F</span>ilms Populaires
                    </h2>
                    <a href="/movies" className="font-display text-xs md:text-sm uppercase tracking-widest text-gray-500 hover:text-gray-800 transition-colors border-b-2 border-gray-400 hover:border-gray-800 pb-1">
                        Voir tout →
                    </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {movies.map((movie) => (
                        <MediaCard key={movie.id} item={movie} type="movie" />
                    ))}
                </div>
            </section>

            <section className="mb-12 md:mb-20">
                <div className="mb-6 md:mb-8 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-600">
                        <span className="text-4xl sm:text-5xl md:text-6xl text-gray-800">S</span>éries Populaires
                    </h2>
                    <a href="/series" className="font-display text-xs md:text-sm uppercase tracking-widest text-gray-500 hover:text-gray-800 transition-colors border-b-2 border-gray-400 hover:border-gray-800 pb-1">
                        Voir tout →
                    </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {series.map((serie) => (
                        <MediaCard key={serie.id} item={serie} type="series" />
                    ))}
                </div>
            </section>

            <section>
                <div className="mb-6 md:mb-8 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-600">
                        <span className="text-4xl sm:text-5xl md:text-6xl text-gray-800">A</span>nimes Populaires
                    </h2>
                    <a href="/anime" className="font-display text-xs md:text-sm uppercase tracking-widest text-gray-500 hover:text-gray-800 transition-colors border-b-2 border-gray-400 hover:border-gray-800 pb-1">
                        Voir tout →
                    </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                    {anime.map((item) => (
                        <MediaCard key={item.id} item={item} type="series" />
                    ))}
                </div>
            </section>
            </div>
            
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default Home;
