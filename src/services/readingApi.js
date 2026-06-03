const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const OPEN_LIBRARY_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const MANGADEX_BASE_URL = 'https://api.mangadex.org';
const BANNED_ROMAN_TERMS = ['manga', 'manhwa', 'manwha', 'manhua', 'comic', 'comics', 'graphic novel'];

const LANGUAGE_LABELS = {
  en: 'Anglais',
  fr: 'Français',
  es: 'Espagnol',
  de: 'Allemand',
  it: 'Italien',
  pt: 'Portugais',
  ja: 'Japonais',
  ko: 'Coréen',
  zh: 'Chinois',
  ru: 'Russe',
  ar: 'Arabe',
  id: 'Indonésien',
  vi: 'Vietnamien',
  tr: 'Turc',
  pl: 'Polonais',
  th: 'Thaï',
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pickMangaDexDescription = (description = {}) => {
  if (description.fr) {
    return description.fr;
  }

  if (description['fr-ro']) {
    return description['fr-ro'];
  }

  return description.en || Object.values(description)[0] || '';
};

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
  id: String(item.key || '').replace('/works/', ''),
  workKey: item.key,
  title: item.title,
  image: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : null,
  year: item.first_publish_year || null,
  score: item.ratings_average || null,
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

  async getJikanReadingDetails(id) {
    const response = await fetch(`${JIKAN_BASE_URL}/manga/${id}/full`);
    const data = await response.json();
    return data?.data || null;
  },

  async getJikanCharacters(id) {
    const response = await fetch(`${JIKAN_BASE_URL}/manga/${id}/characters`);
    const data = await response.json();
    return data?.data || [];
  },

  async getJikanRecommendations(id) {
    const response = await fetch(`${JIKAN_BASE_URL}/manga/${id}/recommendations`);
    const data = await response.json();

    return (data?.data || []).slice(0, 10).map((entry) => {
      const rec = entry.entry || {};
      return {
        id: rec.mal_id,
        title: rec.title,
        image: rec.images?.jpg?.large_image_url || rec.images?.jpg?.image_url || null,
        year: null,
        score: null,
        source: 'Jikan / MyAnimeList',
        url: rec.url,
        type: 'manga',
      };
    });
  },

  async getJikanPersonDetails(id) {
    const response = await fetch(`${JIKAN_BASE_URL}/people/${id}/full`);
    const data = await response.json();
    return data?.data || null;
  },

  async getRomanDetails(workId) {
    const response = await fetch(`${OPEN_LIBRARY_BASE_URL}/works/${workId}.json`);
    const work = await response.json();

    const authorRefs = Array.isArray(work?.authors) ? work.authors : [];
    const authorDetails = await Promise.all(
      authorRefs.slice(0, 10).map(async (author) => {
        const key = author?.author?.key;
        if (!key) {
          return null;
        }

        try {
          const authorResponse = await fetch(`${OPEN_LIBRARY_BASE_URL}${key}.json`);
          const authorData = await authorResponse.json();
          return {
            id: String(key).replace('/authors/', ''),
            name: authorData?.name || 'Auteur inconnu',
            bio: typeof authorData?.bio === 'string' ? authorData.bio : authorData?.bio?.value || '',
            source: 'Open Library',
          };
        } catch (error) {
          return {
            id: String(key).replace('/authors/', ''),
            name: 'Auteur inconnu',
            bio: '',
            source: 'Open Library',
          };
        }
      }),
    );

    return {
      id: workId,
      type: 'roman',
      title: work?.title || 'Titre indisponible',
      synopsis: typeof work?.description === 'string' ? work.description : work?.description?.value || '',
      subjects: Array.isArray(work?.subjects) ? work.subjects.slice(0, 12) : [],
      firstPublishDate: work?.first_publish_date || null,
      covers: Array.isArray(work?.covers) ? work.covers : [],
      authors: authorDetails.filter(Boolean),
      languages: Array.isArray(work?.languages)
        ? work.languages.map((l) => String(l?.key || '').replace('/languages/', '').toUpperCase()).filter(Boolean)
        : [],
      source: 'Open Library',
      raw: work,
    };
  },

  async getMangaDexSupplementByTitles(titles = []) {
    const cleanedTitles = (titles || []).map((title) => String(title || '').trim()).filter(Boolean);
    if (cleanedTitles.length === 0) {
      return null;
    }

    let selected = null;

    for (const title of cleanedTitles.slice(0, 4)) {
      const response = await fetch(
        `${MANGADEX_BASE_URL}/manga?limit=5&title=${encodeURIComponent(title)}&includes[]=author&includes[]=artist&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`,
      );
      const data = await response.json();
      const entries = Array.isArray(data?.data) ? data.data : [];

      if (entries.length === 0) {
        continue;
      }

      const normalizedTitle = normalizeText(title);
      selected = entries.find((entry) => {
        const mdTitles = Object.values(entry?.attributes?.title || {}).concat(Object.values(entry?.attributes?.altTitles || {}).flat());
        const normalizedCandidates = mdTitles.map((candidate) => normalizeText(candidate));
        return normalizedCandidates.some((candidate) => candidate === normalizedTitle || candidate.includes(normalizedTitle) || normalizedTitle.includes(candidate));
      }) || entries[0];

      if (selected) {
        break;
      }
    }

    if (!selected) {
      return null;
    }

    const mangaId = selected.id;
    const attributes = selected.attributes || {};
    const relationships = Array.isArray(selected.relationships) ? selected.relationships : [];

    const aggregateResponse = await fetch(`${MANGADEX_BASE_URL}/manga/${mangaId}/aggregate`);
    const aggregate = await aggregateResponse.json();
    const aggregateVolumes = aggregate?.volumes || {};
    const chapterKeys = new Set();
    Object.values(aggregateVolumes).forEach((volume) => {
      Object.keys(volume?.chapters || {}).forEach((chapterKey) => chapterKeys.add(chapterKey));
    });

    const statsResponse = await fetch(`${MANGADEX_BASE_URL}/statistics/manga/${mangaId}`);
    const statsData = await statsResponse.json();
    const stats = statsData?.statistics?.[mangaId] || {};

    const authorMembers = relationships
      .filter((rel) => rel.type === 'author' || rel.type === 'artist')
      .map((rel) => ({
        id: rel.id,
        name: rel.attributes?.name || 'Inconnu',
        role: rel.type === 'author' ? 'Auteur' : 'Dessinateur',
        source: 'MangaDex',
      }));

    const translatedLanguages = Array.isArray(attributes.availableTranslatedLanguages)
      ? attributes.availableTranslatedLanguages
      : [];

    return {
      mangaDexId: mangaId,
      descriptionFr: pickMangaDexDescription(attributes.description || {}),
      scanChapterCount: chapterKeys.size || null,
      availableTranslatedLanguages: translatedLanguages,
      availableTranslatedLanguageLabels: translatedLanguages.map((code) => LANGUAGE_LABELS[code] || code.toUpperCase()),
      score: Number.isFinite(stats?.rating?.average) ? Number(stats.rating.average) : null,
      scoreSource: 'MangaDex Users',
      tags: Array.isArray(attributes.tags) ? attributes.tags.map((tag) => tag?.attributes?.name?.en).filter(Boolean) : [],
      status: attributes.status || null,
      year: attributes.year || null,
      staff: authorMembers,
    };
  },

  async translateToFrench(text) {
    const input = String(text || '').trim();
    if (!input) {
      return '';
    }

    const shortened = input.length > 2500 ? `${input.slice(0, 2500)}...` : input;

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(shortened)}`,
      );
      const data = await response.json();

      if (!Array.isArray(data) || !Array.isArray(data[0])) {
        return shortened;
      }

      return data[0].map((chunk) => chunk?.[0] || '').join('').trim() || shortened;
    } catch (error) {
      return shortened;
    }
  },
};
