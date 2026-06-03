const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const OPEN_LIBRARY_URL = 'https://openlibrary.org/search.json';
const BANNED_ROMAN_TERMS = ['manga', 'manhwa', 'manwha', 'manhua', 'comic', 'comics', 'graphic novel'];

const toJikanItem = (item, fallbackType) => ({
  id: item.mal_id,
  title: item.title,
  image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
  year: item.published?.prop?.from?.year || null,
  score: item.score || null,
  source: 'Jikan / MyAnimeList',
  url: item.url,
  type: fallbackType,
});

const toOpenLibraryItem = (item, fallbackType) => ({
  id: item.key,
  title: item.title,
  image: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : null,
  year: item.first_publish_year || null,
  score: null,
  source: 'Open Library',
  url: item.key ? `https://openlibrary.org${item.key}` : 'https://openlibrary.org',
  type: fallbackType,
});

const parseOpenLibrary = (data, typeLabel) => {
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  const limit = 20;
  const totalPages = Math.max(1, Math.ceil((data?.numFound || docs.length) / limit));

  return {
    results: docs.map((item) => toOpenLibraryItem(item, typeLabel)),
    totalPages,
  };
};

const isLikelyNonRoman = (item) => {
  const title = String(item?.title || '').toLowerCase();
  const subjectParts = Array.isArray(item?.subject) ? item.subject : [];
  const subject = subjectParts.join(' ').toLowerCase();
  const haystack = `${title} ${subject}`;

  return BANNED_ROMAN_TERMS.some((term) => haystack.includes(term));
};

export const readingApi = {
  async getMangas(page = 1) {
    const response = await fetch(`${JIKAN_BASE_URL}/top/manga?type=manga&page=${page}&sfw=true`);
    const data = await response.json();
    return {
      results: (data?.data || []).map((item) => toJikanItem(item, 'manga')),
      totalPages: Math.max(1, data?.pagination?.last_visible_page || 1),
    };
  },

  async getManwha(page = 1) {
    const response = await fetch(`${JIKAN_BASE_URL}/top/manga?type=manhwa&page=${page}&sfw=true`);
    const data = await response.json();
    return {
      results: (data?.data || []).map((item) => toJikanItem(item, 'manwha')),
      totalPages: Math.max(1, data?.pagination?.last_visible_page || 1),
    };
  },

  async getLightNovels(page = 1) {
    const response = await fetch(`${JIKAN_BASE_URL}/top/manga?type=lightnovel&page=${page}&sfw=true`);
    const data = await response.json();
    return {
      results: (data?.data || []).map((item) => toJikanItem(item, 'light_novel')),
      totalPages: Math.max(1, data?.pagination?.last_visible_page || 1),
    };
  },

  async getRomans(page = 1) {
    const response = await fetch(`${OPEN_LIBRARY_URL}?q=novel&page=${page}&limit=40`);
    const data = await response.json();
    const parsed = parseOpenLibrary(data, 'roman');

    return {
      ...parsed,
      results: parsed.results.filter((_, idx) => !isLikelyNonRoman(data.docs[idx])).slice(0, 20),
    };
  },
};
