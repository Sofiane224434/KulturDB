import { useState, useEffect } from 'react';
import ReadingCard from '../components/ReadingCard';
import Pagination from '../components/Pagination';
import { readingApi } from '../services/readingApi';

const CATEGORY_CONFIG = {
  manga: {
    title: 'Manga',
    load: (page) => readingApi.getMangas(page),
  },
  manwha: {
    title: 'Manwha',
    load: (page) => readingApi.getManwha(page),
  },
  light_novel: {
    title: 'Light Novels',
    load: (page) => readingApi.getLightNovels(page),
  },
  roman: {
    title: 'Romans',
    load: (page) => readingApi.getRomans(page),
  },
};

function ReadingCategoryPage({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.manga;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [category]);

  useEffect(() => {
    const loadCatalog = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await config.load(page);
        setItems(data.results || []);
        setTotalPages(Math.max(1, Math.min(data.totalPages || 1, 500)));
      } catch (err) {
        console.error('Erreur de chargement du catalogue:', err);
        setError('Impossible de charger cette categorie pour le moment.');
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
    window.scrollTo(0, 0);
  }, [config, page]);

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6 md:mb-8">
          <span className="text-5xl sm:text-6xl md:text-7xl text-gray-800">{config.title.charAt(0)}</span>{config.title.slice(1)}
        </h1>

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

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default ReadingCategoryPage;
