function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 1) {
    return [1];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 3) {
    start = 2;
    end = 4;
  } else if (currentPage >= totalPages - 2) {
    start = totalPages - 3;
    end = totalPages - 1;
  }

  if (start > 2) {
    items.push('ellipsis-left');
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < totalPages - 1) {
    items.push('ellipsis-right');
  }

  items.push(totalPages);
  return items;
}

function Pagination({ page, totalPages, onPageChange }) {
  const safeTotal = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(1, page || 1), safeTotal);
  const items = buildPaginationItems(safePage, safeTotal);

  const handleDirectSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const requestedPage = Number(formData.get('page'));
    if (!Number.isFinite(requestedPage)) {
      return;
    }

    onPageChange(Math.min(safeTotal, Math.max(1, requestedPage)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3">
        <button
          onClick={() => onPageChange(Math.max(1, safePage - 5))}
          disabled={safePage === 1}
          className="px-3 md:px-4 py-2 text-xs md:text-sm font-display uppercase tracking-wider bg-white text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-2 border-gray-400"
        >
          -5
        </button>

        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="px-3 md:px-4 py-2 text-xs md:text-sm font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-2 border-gray-800"
        >
          Precedent
        </button>

        {items.map((item, index) => {
          if (typeof item !== 'number') {
            return (
              <span key={`${item}-${index}`} className="px-2 py-1 font-display text-sm text-gray-500">
                ...
              </span>
            );
          }

          const active = item === safePage;
          return (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              className={`min-w-9 px-3 py-2 text-xs md:text-sm font-display uppercase tracking-wider border-2 transition-colors ${
                active
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-400 hover:border-gray-700 hover:text-gray-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {item}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(Math.min(safeTotal, safePage + 1))}
          disabled={safePage >= safeTotal}
          className="px-3 md:px-4 py-2 text-xs md:text-sm font-display uppercase tracking-wider bg-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-2 border-gray-800"
        >
          Suivant
        </button>

        <button
          onClick={() => onPageChange(Math.min(safeTotal, safePage + 5))}
          disabled={safePage >= safeTotal}
          className="px-3 md:px-4 py-2 text-xs md:text-sm font-display uppercase tracking-wider bg-white text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-2 border-gray-400"
        >
          +5
        </button>
      </div>

      <form onSubmit={handleDirectSubmit} className="flex flex-wrap justify-center items-center gap-2">
        <label htmlFor="directPage" className="font-display text-xs uppercase tracking-wider text-gray-500">
          Aller page
        </label>
        <input
          id="directPage"
          name="page"
          type="number"
          min="1"
          max={safeTotal}
          defaultValue={safePage}
          className="w-24 px-3 py-2 border-2 border-gray-400 bg-white font-serif text-sm text-gray-700"
        />
        <button
          type="submit"
          className="px-3 py-2 text-xs font-display uppercase tracking-wider bg-black text-gray-300 border-2 border-gray-800"
        >
          OK
        </button>
      </form>
    </div>
  );
}

export default Pagination;