import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReadingCard from '../components/ReadingCard';
import { readingApi } from '../services/readingApi';
import { useLibrary } from '../hooks/useLocalStorage';
import { useTopPicks } from '../hooks/useLocalStorage';

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractAuthorTokens = (name) => {
  const normalized = normalizeName(name);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
};

const pickBestReadingTitle = (detail, supplement) => {
  if (!detail) {
    return 'Titre indisponible';
  }

  if (supplement?.titleFr) {
    return supplement.titleFr;
  }

  const titleEntries = Array.isArray(detail.titles) ? detail.titles : [];
  const frenchTitle = titleEntries.find((entry) => /french/i.test(String(entry?.type || '')))?.title;
  const englishTitle = detail.title_english || titleEntries.find((entry) => /english/i.test(String(entry?.type || '')))?.title;
  return frenchTitle || englishTitle || detail.title || 'Titre indisponible';
};

const isSupplementConsistentWithJikan = (mainData, mdxSupplement) => {
  if (!mainData || !mdxSupplement) {
    return false;
  }

  const jikanAuthors = (mainData.authors || []).map((author) => author?.name).filter(Boolean);
  const mdxAuthors = (mdxSupplement.staff || []).map((member) => member?.name).filter(Boolean);

  if (jikanAuthors.length === 0 || mdxAuthors.length === 0) {
    return true;
  }

  const jikanTokens = new Set(jikanAuthors.flatMap((name) => extractAuthorTokens(name)));
  const mdxTokens = new Set(mdxAuthors.flatMap((name) => extractAuthorTokens(name)));

  if (jikanTokens.size === 0 || mdxTokens.size === 0) {
    return true;
  }

  return Array.from(jikanTokens).some((token) => mdxTokens.has(token));
};

function StatBlock({ label, value }) {
  return (
    <div className="bg-white border-2 border-gray-300 p-3">
      <p className="text-xs font-display uppercase tracking-wider text-gray-500">{label}</p>
      <p className="font-serif text-sm text-gray-700 mt-1">{value || 'N/A'}</p>
    </div>
  );
}

function ReadingDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { isInLibrary, addToLibrary, removeFromLibrary } = useLibrary();
  const { isInTopPicks, addToTopPicks, removeFromTopPicks } = useTopPicks();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [supplement, setSupplement] = useState(null);
  const [frenchSynopsis, setFrenchSynopsis] = useState('');
  const [characters, setCharacters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [inLibrary, setInLibrary] = useState(false);
  const [isInTop, setIsInTop] = useState(false);

  const isJikanType = type === 'manga' || type === 'manwha' || type === 'light_novel';

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      setError('');

      try {
        if (isJikanType) {
          const mainData = await readingApi.getJikanReadingDetails(id);
          const titleCandidates = [
            mainData?.title,
            ...(mainData?.titles || []).map((entry) => entry?.title),
            mainData?.title_english,
            mainData?.title_japanese,
          ].filter(Boolean);

          const [charsData, recData, mdxSupplement] = await Promise.all([
            readingApi.getJikanCharacters(id),
            readingApi.getJikanRecommendations(id),
            readingApi.getMangaDexSupplementByTitles(titleCandidates, id).catch(() => null),
          ]);

          const safeSupplement = isSupplementConsistentWithJikan(mainData, mdxSupplement)
            ? mdxSupplement
            : null;

          const frSynopsis = safeSupplement?.descriptionFr
            ? safeSupplement.descriptionFr
            : await readingApi.translateToFrench(mainData?.synopsis || mainData?.background || '');

          setDetail(mainData);
          setSupplement(safeSupplement);
          setFrenchSynopsis(frSynopsis);
          setCharacters(charsData.slice(0, 12));
          setRecommendations(recData || []);
        } else if (type === 'roman') {
          const romanData = await readingApi.getRomanDetails(id);
          const frSynopsis = await readingApi.translateToFrench(romanData?.synopsis || '');
          setDetail(romanData);
          setSupplement(null);
          setFrenchSynopsis(frSynopsis || romanData?.synopsis || '');
          setCharacters([]);
          setRecommendations([]);
        } else {
          setError('Type de contenu non supporte.');
        }
      } catch (err) {
        console.error('Erreur de chargement detail lecture:', err);
        setError('Impossible de charger les details de cette oeuvre.');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
    window.scrollTo(0, 0);
  }, [id, isJikanType, type]);

  useEffect(() => {
    setInLibrary(isInLibrary(id, type));
  }, [id, isInLibrary, type]);

  useEffect(() => {
    setIsInTop(isInTopPicks(id, type));
  }, [id, isInTopPicks, type]);

  const coverUrl = useMemo(() => {
    if (!detail) {
      return null;
    }

    if (isJikanType) {
      return detail.images?.jpg?.large_image_url || detail.images?.jpg?.image_url || null;
    }

    if (type === 'roman' && Array.isArray(detail.covers) && detail.covers.length > 0) {
      return `https://covers.openlibrary.org/b/id/${detail.covers[0]}-L.jpg`;
    }

    return null;
  }, [detail, isJikanType, type]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="border-2 border-red-300 bg-red-50 p-8 text-center">
          <p className="font-display uppercase tracking-wider text-red-700">Erreur</p>
          <p className="font-serif text-sm text-red-600 mt-2">{error || 'Aucune donnee trouvee.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 text-sm font-display uppercase tracking-wider bg-black text-gray-300 border border-gray-800"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  const title = isJikanType ? pickBestReadingTitle(detail, supplement) : detail.title;
  const score = isJikanType ? (supplement?.score ?? detail.score) : null;
  const scoreSource = isJikanType ? (supplement?.scoreSource || 'MyAnimeList (Jikan)') : detail.source;
  const synopsis = isJikanType ? (frenchSynopsis || '') : (frenchSynopsis || detail.synopsis || '');

  const genres = isJikanType
    ? [
        ...(detail.genres || []),
        ...(detail.themes || []),
        ...(detail.demographics || []),
        ...((supplement?.tags || []).map((name) => ({ name }))),
      ].map((g) => g.name)
    : detail.subjects || [];

  const translations = isJikanType
    ? [
        ...(supplement?.availableTranslatedLanguageLabels || []).map((label) => `Scan: ${label}`),
        ...(detail.titles || []).map((t) => `${t.type}: ${t.title}`),
      ]
    : (detail.languages || []).map((lang) => `Langue: ${lang}`);

  const staff = isJikanType
    ? [
        ...((supplement?.staff || []).map((member) => ({
          id: null,
          name: member.name,
          role: member.role,
          source: member.source,
        }))),
        ...(detail.authors || []).map((a) => ({
          id: a.person?.mal_id,
          name: a.person?.name,
          role: a.type,
        })),
      ]
    : (detail.authors || []).map((a) => ({
        id: a.id,
        name: a.name,
        role: 'Auteur',
        source: a.source,
      }));

  const handleLibraryToggle = () => {
    if (!detail) {
      return;
    }

    if (inLibrary) {
      removeFromLibrary(id, type);
      setInLibrary(false);
      return;
    }

    addToLibrary(
      {
        id,
        title,
        image: coverUrl,
        year: isJikanType ? detail?.published?.prop?.from?.year || null : detail?.firstPublishDate || null,
        source: isJikanType ? 'Jikan / MyAnimeList' : 'Open Library',
      },
      type,
      {
        progressUnit: isJikanType ? 'chapitre' : 'page',
        progressTotal: isJikanType ? (detail?.chapters || supplement?.scanChapterCount || null) : null,
      },
    );
    setInLibrary(true);
  };

  const handleTopToggle = () => {
    if (!detail) {
      return;
    }

    if (isInTop) {
      removeFromTopPicks(id, type);
      setIsInTop(false);
      return;
    }

    addToTopPicks(
      {
        id,
        title,
        image: coverUrl,
        year: isJikanType ? detail?.published?.prop?.from?.year || null : detail?.firstPublishDate || null,
        source: isJikanType ? 'Jikan / MyAnimeList' : 'Open Library',
      },
      type,
    );
    setIsInTop(true);
  };

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-display uppercase tracking-wider bg-gray-800 text-gray-300 border-2 border-gray-900"
          >
            ← Retour
          </button>

          <button
            onClick={handleTopToggle}
            className="px-4 py-2 text-sm font-display uppercase tracking-wider bg-black text-gray-200 border-2 border-gray-900"
          >
            {isInTop ? '★ Retirer de mon top' : '☆ Ajouter a mon top'}
          </button>

          <button
            onClick={handleLibraryToggle}
            className="px-4 py-2 text-sm font-display uppercase tracking-wider bg-black text-gray-200 border-2 border-gray-900"
          >
            {inLibrary ? '✓ Retirer de ma bibliothèque' : '+ Ajouter à ma bibliothèque'}
          </button>
        </div>

        <div className="grid md:grid-cols-[320px_1fr] gap-8 md:gap-10">
          <div>
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="w-full border-4 border-gray-800" />
            ) : (
              <div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center border-4 border-gray-800">
                <span className="text-gray-600 text-5xl font-display">?</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatBlock label="Note" value={score ? `${Number(score).toFixed(2)} / 10` : 'N/A'} />
              <StatBlock label="Source Note" value={scoreSource} />
              <StatBlock label="Type" value={isJikanType ? detail.type : 'Roman'} />
              <StatBlock label="Statut" value={isJikanType ? (supplement?.status || detail.status) : 'Publication'} />
              <StatBlock label="Chapitres" value={isJikanType ? (detail.chapters || 'N/A') : 'N/A'} />
              <StatBlock label="Chapitres (Scan)" value={isJikanType ? (supplement?.scanChapterCount || 'N/A') : 'N/A'} />
              <StatBlock label="Volumes" value={isJikanType ? detail.volumes : 'N/A'} />
            </div>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-700 mb-3">
              {title}
            </h1>

            <div className="flex flex-wrap gap-2 mb-6">
              {genres.slice(0, 16).map((genre) => (
                <span key={genre} className="font-display text-xs uppercase tracking-wider text-gray-700 bg-gray-200 px-2 py-1 border border-gray-400">
                  {genre}
                </span>
              ))}
            </div>

            <section className="mb-6 border-2 border-gray-300 bg-white p-4">
              <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-2">Synopsis / Resume</h2>
              <p className="font-serif text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {synopsis || 'Synopsis indisponible pour cette oeuvre.'}
              </p>
            </section>

            <section className="mb-6 border-2 border-gray-300 bg-white p-4">
              <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-2">Traductions Disponibles</h2>
              {translations.length > 0 ? (
                <ul className="space-y-1 text-sm font-serif text-gray-700">
                  {translations.map((translation, index) => (
                    <li key={`${translation}-${index}`}>• {translation}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-serif text-gray-600">Aucune information de traduction fournie par la source.</p>
              )}
            </section>

            <section className="mb-6 border-2 border-gray-300 bg-white p-4">
              <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-2">Equipe / Creatifs</h2>
              {staff.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {staff.map((member, index) => (
                    <div key={`${member.id || member.name}-${index}`} className="border border-gray-300 px-3 py-2 bg-gray-50">
                      <p className="font-display text-sm uppercase tracking-wider text-gray-700">{member.name || 'Inconnu'}</p>
                      <p className="font-serif text-xs text-gray-600 mt-1">{member.role || 'Contributeur'}</p>
                      {isJikanType && member.id ? (
                        <Link to={`/reading/person/${member.id}`} className="text-xs font-serif text-gray-700 underline mt-1 inline-block">
                          Profil
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-serif text-gray-600">Aucune equipe detaillee disponible.</p>
              )}
            </section>

            {isJikanType && characters.length > 0 && (
              <section className="mb-6 border-2 border-gray-300 bg-white p-4">
                <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-2">Personnages</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {characters.map((entry) => (
                    <div key={entry.character?.mal_id} className="border border-gray-300 px-3 py-2 bg-gray-50">
                      <p className="font-display text-sm uppercase tracking-wider text-gray-700">{entry.character?.name}</p>
                      <p className="font-serif text-xs text-gray-600 mt-1">{entry.role}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {recommendations.length > 0 && (
          <section className="mt-10">
            <div className="mb-6 flex items-center justify-between gap-2">
              <h2 className="text-2xl sm:text-3xl font-display uppercase tracking-wider text-gray-700">Similaires</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
              {recommendations.map((item) => (
                <ReadingCard key={`rec-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default ReadingDetail;
