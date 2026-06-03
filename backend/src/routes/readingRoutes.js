import { Router } from 'express';

const router = Router();

const MANGADEX_BASE_URL = 'https://api.mangadex.org';
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

router.get('/mangadex/supplement', async (req, res) => {
    try {
        const queryTitles = req.query.title;
        const malId = String(req.query.malId || '').trim();
        const rawTitles = Array.isArray(queryTitles) ? queryTitles : [queryTitles];
        const titles = rawTitles.map((title) => String(title || '').trim()).filter(Boolean);

        if (titles.length === 0) {
            return res.status(400).json({ error: 'title query parameter is required' });
        }

        let selected = null;

        for (const title of titles.slice(0, 5)) {
            const response = await fetch(
                `${MANGADEX_BASE_URL}/manga?limit=5&title=${encodeURIComponent(title)}&includes[]=author&includes[]=artist&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`,
            );
            const data = await response.json();
            const entries = Array.isArray(data?.data) ? data.data : [];

            if (entries.length === 0) {
                continue;
            }

            if (malId) {
                const byMalId = entries.find((entry) => String(entry?.attributes?.links?.mal || '') === malId);
                if (byMalId) {
                    selected = byMalId;
                    break;
                }
            }

            const normalizedTitle = normalizeText(title);
            if (!normalizedTitle) {
                continue;
            }

            const matchedEntry = entries.find((entry) => {
                    const baseTitles = Object.values(entry?.attributes?.title || {});
                    const altTitles = Array.isArray(entry?.attributes?.altTitles)
                        ? entry.attributes.altTitles.flatMap((titleObj) => Object.values(titleObj || {}))
                        : [];
                    const mdTitles = [...baseTitles, ...altTitles];
                    const normalizedCandidates = mdTitles.map((candidate) => normalizeText(candidate)).filter(Boolean);

                    return normalizedCandidates.some(
                        (candidate) =>
                            candidate === normalizedTitle ||
                            candidate.includes(normalizedTitle) ||
                            normalizedTitle.includes(candidate),
                    );
                });

            if (matchedEntry) {
                selected = matchedEntry;
            }

            if (selected) {
                break;
            }
        }

        if (!selected) {
            return res.json(null);
        }

        const mangaId = selected.id;
        const attributes = selected.attributes || {};
        const relationships = Array.isArray(selected.relationships) ? selected.relationships : [];

        const [aggregateResponse, statsResponse] = await Promise.all([
            fetch(`${MANGADEX_BASE_URL}/manga/${mangaId}/aggregate`),
            fetch(`${MANGADEX_BASE_URL}/statistics/manga/${mangaId}`),
        ]);

        const aggregate = await aggregateResponse.json();
        const statsData = await statsResponse.json();

        const aggregateVolumes = aggregate?.volumes || {};
        const chapterKeys = new Set();
        Object.values(aggregateVolumes).forEach((volume) => {
            Object.keys(volume?.chapters || {}).forEach((chapterKey) => chapterKeys.add(chapterKey));
        });

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

        return res.json({
            mangaDexId: mangaId,
            descriptionFr: pickMangaDexDescription(attributes.description || {}),
            scanChapterCount: chapterKeys.size || null,
            availableTranslatedLanguages: translatedLanguages,
            availableTranslatedLanguageLabels: translatedLanguages.map((code) => LANGUAGE_LABELS[code] || code.toUpperCase()),
            score: Number.isFinite(stats?.rating?.average) ? Number(stats.rating.average) : null,
            scoreSource: 'MangaDex Users',
            tags: Array.isArray(attributes.tags)
                ? attributes.tags.map((tag) => tag?.attributes?.name?.en).filter(Boolean)
                : [],
            status: attributes.status || null,
            year: attributes.year || null,
            staff: authorMembers,
        });
    } catch (error) {
        return res.status(500).json({ error: 'failed_to_fetch_mangadex_supplement' });
    }
});

router.get('/translate-fr', async (req, res) => {
    try {
        const input = String(req.query.q || '').trim();
        if (!input) {
            return res.status(400).json({ error: 'q query parameter is required' });
        }

        const shortened = input.length > 2500 ? `${input.slice(0, 2500)}...` : input;

        const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(shortened)}`,
        );
        const data = await response.json();

        if (!Array.isArray(data) || !Array.isArray(data[0])) {
            return res.json({ text: shortened });
        }

        const text = data[0].map((chunk) => chunk?.[0] || '').join('').trim() || shortened;
        return res.json({ text });
    } catch (error) {
        return res.status(500).json({ error: 'failed_to_translate_text' });
    }
});

export default router;
