import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReadingCard from '../components/ReadingCard';
import { readingApi } from '../services/readingApi';

function Watchlist() {
    const [searchParams] = useSearchParams();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [typeFilter, setTypeFilter] = useState('manga');

    useEffect(() => {
        const fromQuery = searchParams.get('type') || 'manga';
        const normalized = fromQuery === 'manhwa' ? 'manwha' : fromQuery;

        if (['manga', 'manwha', 'light_novel', 'web_novel', 'roman'].includes(normalized)) {
            setTypeFilter(normalized);
            setPage(1);
        }
    }, [searchParams]);

    useEffect(() => {
        const loadCatalog = async () => {
            setLoading(true);
            setError('');

            try {
                let data;

                switch (typeFilter) {
                    case 'manga':
                        data = await readingApi.getMangas(page);
                        break;
                    case 'manwha':
                        data = await readingApi.getManwha(page);
                        break;
                    case 'light_novel':
                        data = await readingApi.getLightNovels(page);
                        break;
                    case 'web_novel':
                        data = await readingApi.getWebNovels(page);
                        break;
                    case 'roman':
                        data = await readingApi.getRomans(page);
                        break;
                    default:
                        data = await readingApi.getMangas(page);
                        break;
                }

                setItems(data.results || []);
                setTotalPages(Math.max(1, Math.min(data.totalPages || 1, 500)));
            } catch (err) {
                console.error('Erreur de chargement du catalogue:', err);
                setError('Impossible de charger la base pour le moment. Reessayez dans quelques instants.');
            } finally {
                setLoading(false);
            }
        };

        loadCatalog();
        window.scrollTo(0, 0);
    }, [typeFilter, page]);

    const typeButtons = [
        { key: 'manga', label: 'Manga' },
        { key: 'manwha', label: 'Manwha' },
        { key: 'light_novel', label: 'Light Novel' },
        { key: 'web_novel', label: 'Web Novel' },
        { key: 'roman', label: 'Roman' },
    ];

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>

            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6 md:mb-8">
                    <span className="text-5xl sm:text-6xl md:text-7xl text-gray-800">B</span>ase API Mangas, Novels et Romans
                </h1>

                <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
                    {typeButtons.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => {
                                setTypeFilter(key);
                                setPage(1);
                            }}
                            className={`px-3 py-2 text-xs md:text-sm font-display uppercase tracking-wider border ${typeFilter === key ? 'bg-black text-gray-300 border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
                    </div>
                ) : error ? (
                    <div className="border-2 border-red-300 bg-red-50 p-8 text-center">
                        <p className="font-display uppercase tracking-wider text-red-700">Erreur API</p>
                        <p className="font-serif text-sm text-red-600 mt-2">{error}</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="border-2 border-gray-300 bg-white p-8 text-center">
                        <p className="font-display uppercase tracking-wider text-gray-700">Aucun resultat pour cette categorie</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 mb-8 md:mb-12">
                            {items.map((item) => (
                                <ReadingCard key={`${item.type}-${item.id}`} item={item} />
                            ))}
                        </div>

                        <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-2 border-gray-800"
                            >
                                ← Precedent
                            </button>
                            <span className="font-display text-sm md:text-base text-gray-600">Page {page} / {totalPages}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-2 border-gray-800"
                            >
                                Suivant →
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Watchlist;
