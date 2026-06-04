import { useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi';

const MEDIA_TYPES = [
  { value: 'movie', label: 'Film' },
  { value: 'series', label: 'Serie' },
  { value: 'anime', label: 'Anime' },
];

function parseSeasonBreakdownInput(value) {
  if (!String(value || '').trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .map((entry) => ({
        seasonNumber: Number(entry?.seasonNumber),
        episodeCount: Number(entry?.episodeCount),
      }))
      .filter((entry) => Number.isFinite(entry.seasonNumber) && entry.seasonNumber > 0 && Number.isFinite(entry.episodeCount) && entry.episodeCount > 0);
  } catch {
    return null;
  }
}

function toFormState(entry = null) {
  return {
    mediaType: entry?.mediaType || 'series',
    mediaRefId: entry?.mediaRefId || '',
    title: entry?.title || '',
    overview: entry?.overview || '',
    posterPath: entry?.posterPath || '',
    backdropPath: entry?.backdropPath || '',
    releaseYear: Number.isFinite(entry?.releaseYear) ? String(entry.releaseYear) : '',
    episodesTotal: Number.isFinite(entry?.episodesTotal) ? String(entry.episodesTotal) : '',
    seasonBreakdownText: Array.isArray(entry?.seasonBreakdown) && entry.seasonBreakdown.length
      ? JSON.stringify(entry.seasonBreakdown, null, 2)
      : '',
    isHidden: !!entry?.isHidden,
  };
}

function AdminMediaManager() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => toFormState(null));

  const title = useMemo(() => (editingId ? 'Modifier une fiche admin' : 'Ajouter une fiche admin'), [editingId]);

  const loadEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.listAdminMediaEntries();
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (apiError) {
      setError(apiError.message || 'Impossible de charger les fiches admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(toFormState(null));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const mediaRefId = String(form.mediaRefId || '').trim();
    if (!mediaRefId) {
      setError('L identifiant TMDB est obligatoire.');
      return;
    }

    const seasonBreakdown = parseSeasonBreakdownInput(form.seasonBreakdownText);
    if (seasonBreakdown === null) {
      setError('Le JSON des saisons est invalide.');
      return;
    }

    const payload = {
      mediaType: form.mediaType,
      mediaRefId,
      title: form.title.trim() || null,
      overview: form.overview.trim() || null,
      posterPath: form.posterPath.trim() || null,
      backdropPath: form.backdropPath.trim() || null,
      releaseYear: form.releaseYear ? Number(form.releaseYear) : null,
      episodesTotal: form.episodesTotal ? Number(form.episodesTotal) : null,
      seasonBreakdown,
      isHidden: form.isHidden,
    };

    setSaving(true);
    try {
      if (editingId) {
        await authApi.updateAdminMediaEntry(editingId, payload);
        setSuccess('Fiche admin mise a jour.');
      } else {
        await authApi.createAdminMediaEntry(payload);
        setSuccess('Fiche admin creee.');
      }

      resetForm();
      await loadEntries();
    } catch (apiError) {
      setError(apiError.message || 'Operation impossible.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setForm(toFormState(entry));
    setSuccess('');
    setError('');
  };

  const handleDelete = async (entryId) => {
    const ok = window.confirm('Supprimer cette fiche admin ?');
    if (!ok) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await authApi.deleteAdminMediaEntry(entryId);
      if (editingId === entryId) {
        resetForm();
      }
      setSuccess('Fiche admin supprimee.');
      await loadEntries();
    } catch (apiError) {
      setError(apiError.message || 'Suppression impossible.');
    }
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 border-b border-gray-300 pb-4">
        <h1 className="font-display text-3xl md:text-4xl uppercase tracking-widest text-gray-900">Administration des fiches</h1>
        <p className="mt-2 text-sm text-gray-700">Ajoute, modifie ou masque des fiches TMDB, et ajuste les saisons/episodes affiches.</p>
      </header>

      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className="mb-8 border border-gray-300 bg-white p-4 md:p-6">
        <h2 className="mb-4 font-display text-xl uppercase tracking-wider text-gray-900">{title}</h2>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Type
            <select
              value={form.mediaType}
              onChange={(event) => setField('mediaType', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
            >
              {MEDIA_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            TMDB ID
            <input
              value={form.mediaRefId}
              onChange={(event) => setField('mediaRefId', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Ex: 94997"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Titre (override)
            <input
              value={form.title}
              onChange={(event) => setField('title', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Laisse vide pour TMDB"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Annee (override)
            <input
              type="number"
              value={form.releaseYear}
              onChange={(event) => setField('releaseYear', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Ex: 2024"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Episodes totaux (override)
            <input
              type="number"
              value={form.episodesTotal}
              onChange={(event) => setField('episodesTotal', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Ex: 24"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
            Poster path (override)
            <input
              value={form.posterPath}
              onChange={(event) => setField('posterPath', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Ex: /abc123.jpg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
            Backdrop path (override)
            <input
              value={form.backdropPath}
              onChange={(event) => setField('backdropPath', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Ex: /xyz789.jpg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
            Description (override)
            <textarea
              rows={3}
              value={form.overview}
              onChange={(event) => setField('overview', event.target.value)}
              className="border border-gray-300 px-2 py-2 text-sm"
              placeholder="Description personnalisee"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
            Saisons (JSON)
            <textarea
              rows={4}
              value={form.seasonBreakdownText}
              onChange={(event) => setField('seasonBreakdownText', event.target.value)}
              className="border border-gray-300 px-2 py-2 font-mono text-xs"
              placeholder={'[{"seasonNumber":1,"episodeCount":12}]'}
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.isHidden}
              onChange={(event) => setField('isHidden', event.target.checked)}
            />
            Masquer cette fiche des listes publiques
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black px-4 py-2 text-xs font-display uppercase tracking-wider text-gray-300 disabled:opacity-60"
            >
              {saving ? 'Sauvegarde...' : editingId ? 'Mettre a jour' : 'Ajouter'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="border border-gray-300 bg-white px-4 py-2 text-xs font-display uppercase tracking-wider text-gray-700"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="border border-gray-300 bg-white p-4 md:p-6">
        <h2 className="mb-4 font-display text-xl uppercase tracking-wider text-gray-900">Fiches admin existantes</h2>

        {loading ? (
          <p className="text-sm text-gray-600">Chargement...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune fiche admin configuree.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article key={entry.id} className="border border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-sm uppercase tracking-wider text-gray-900">
                      {entry.title || 'Sans titre'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {entry.mediaType} • TMDB {entry.mediaRefId} • {entry.isHidden ? 'Masquee' : 'Visible'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(entry)}
                      className="border border-gray-300 bg-white px-3 py-1 text-xs font-display uppercase tracking-wider text-gray-700"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="border border-red-300 bg-red-50 px-3 py-1 text-xs font-display uppercase tracking-wider text-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminMediaManager;
