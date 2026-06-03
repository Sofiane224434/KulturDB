function ReadingCard({ item }) {
  return (
    <article className="group border-2 border-gray-800 bg-white overflow-hidden">
      {item.image ? (
        <img
          src={item.image}
          alt={item.title}
          className="w-full aspect-[2/3] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-[2/3] bg-gray-900 flex items-center justify-center">
          <span className="text-gray-600 text-4xl font-display">?</span>
        </div>
      )}

      <div className="p-3">
        <h3 className="font-display text-lg uppercase tracking-wider text-gray-700 line-clamp-2 min-h-[3.5rem]">
          {item.title}
        </h3>

        <div className="mt-2 flex items-center justify-between text-xs font-serif text-gray-600">
          <span>{item.year || 'N/A'}</span>
          {item.score ? <span>★ {Number(item.score).toFixed(1)}</span> : <span>-</span>}
        </div>

        <p className="mt-2 text-xs font-serif text-gray-500 line-clamp-1">{item.source}</p>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block w-full text-center px-3 py-2 text-xs font-display uppercase tracking-wider bg-black text-gray-300 hover:text-white transition-colors border border-gray-800"
        >
          Voir la fiche
        </a>
      </div>
    </article>
  );
}

export default ReadingCard;
