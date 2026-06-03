import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary } from '../hooks/useLocalStorage';
import { useUiPreferences } from '../context/UiPreferencesContext';

function ReadingCard({ item }) {
  const { isInLibrary, addToLibrary } = useLibrary();
  const { preferences } = useUiPreferences();
  const detailPath = item.type === 'roman' ? `/reading/roman/${item.id}` : `/reading/${item.type}/${item.id}`;
  const [inLibraryState, setInLibraryState] = useState(false);

  useEffect(() => {
    setInLibraryState(isInLibrary(item.id, item.type));
  }, [isInLibrary, item.id, item.type]);

  const handleQuickAdd = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (inLibraryState) {
      return;
    }

    addToLibrary(
      {
        id: item.id,
        title: item.title,
        image: item.image || null,
        year: item.year || null,
        source: item.source || null,
      },
      item.type,
      {
        progressUnit: item.type === 'roman' ? 'page' : 'chapitre',
        progressTotal: null,
      },
    );
    setInLibraryState(true);
  };

  return (
    <div className="relative group">
    <Link to={detailPath} className="block">
    <article className="border-2 border-gray-800 bg-white overflow-hidden">
      {item.image ? (
        <img
          src={item.image}
          alt={item.title}
          className={`w-full aspect-2/3 object-cover transition-all duration-500 ${preferences.showCardColors ? 'group-hover:scale-[1.01]' : 'grayscale group-hover:grayscale-0'}`}
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center">
          <span className="text-gray-600 text-4xl font-display">?</span>
        </div>
      )}

      <div className="p-3">
        <h3 className="font-display text-lg uppercase tracking-wider text-gray-700 line-clamp-2 min-h-14">
          {item.title}
        </h3>

        <div className="mt-2 flex items-center justify-between text-xs font-serif text-gray-600">
          <span>{item.year || 'N/A'}</span>
          {item.score ? <span>★ {Number(item.score).toFixed(1)}</span> : <span>-</span>}
        </div>

        <p className="mt-2 text-xs font-serif text-gray-500 line-clamp-1">{item.source}</p>
      </div>
    </article>
    </Link>

    <button
      onClick={handleQuickAdd}
      aria-label={inLibraryState ? 'Déjà dans la bibliothèque' : 'Ajouter à ma bibliothèque'}
      className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 border-2 font-display text-lg leading-none flex items-center justify-center transition-colors ${inLibraryState ? 'bg-gray-700 text-gray-200 border-gray-900' : 'bg-black text-gray-200 border-gray-800 hover:text-white'}`}
    >
      {inLibraryState ? '✓' : '+'}
    </button>
    </div>
  );
}

export default ReadingCard;
