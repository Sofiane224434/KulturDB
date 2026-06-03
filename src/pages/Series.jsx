import { useState, useEffect } from 'react';
import MediaCard from '../components/MediaCard';
import Pagination from '../components/Pagination';
import { tmdbService } from '../services/tmdb';

function Series() {
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    useEffect(() => {
        const fetchSeries = async () => {
            setLoading(true);
            try {
                const data = await tmdbService.getPopularSeries(page);
                setSeries(data.results);
                setTotalPages(Math.min(data.total_pages, 500));
            } catch (error) {
                console.error('Erreur:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSeries();
        window.scrollTo(0, 0);
    }, [page]);

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            
            <div className="px-3 sm:px-6 md:px-12 py-6 md:py-8">
                <header className="mb-8 md:mb-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-4">
                    <span className="text-5xl sm:text-6xl md:text-7xl text-gray-800">S</span>éries
                </h1>
                <div className="h-1 w-24 md:w-32 bg-gray-400"></div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 mb-8 md:mb-12">
                {series.map((serie) => (
                    <MediaCard key={serie.id} item={serie} type="series" />
                ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
            
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default Series;
