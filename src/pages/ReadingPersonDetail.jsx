import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { readingApi } from '../services/readingApi';

function ReadingPersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [person, setPerson] = useState(null);

  useEffect(() => {
    const loadPerson = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await readingApi.getJikanPersonDetails(id);
        setPerson(data);
      } catch (err) {
        console.error('Erreur chargement fiche auteur/dessinateur:', err);
        setError('Impossible de charger cette fiche pour le moment.');
      } finally {
        setLoading(false);
      }
    };

    loadPerson();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="border-2 border-red-300 bg-red-50 p-8 text-center">
          <p className="font-display uppercase tracking-wider text-red-700">Erreur</p>
          <p className="font-serif text-sm text-red-600 mt-2">{error || 'Fiche introuvable.'}</p>
        </div>
      </div>
    );
  }

  const imageUrl = person.images?.jpg?.image_url || null;
  const about = person.about || '';
  const works = (person.manga || []).slice(0, 20);

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 md:py-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 px-4 py-2 text-sm font-display uppercase tracking-wider bg-gray-800 text-gray-300 border-2 border-gray-900"
        >
          ← Retour
        </button>

        <div className="grid md:grid-cols-[260px_1fr] gap-8 md:gap-10">
          <div>
            {imageUrl ? (
              <img src={imageUrl} alt={person.name} className="w-full border-4 border-gray-800" />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-900 border-4 border-gray-800 flex items-center justify-center">
                <span className="text-gray-600 text-5xl font-display">?</span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-wider text-gray-700 mb-4">{person.name}</h1>

            <section className="mb-6 border-2 border-gray-300 bg-white p-4">
              <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-2">Biographie</h2>
              <p className="font-serif text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {about || 'Biographie non disponible.'}
              </p>
            </section>

            <section className="border-2 border-gray-300 bg-white p-4">
              <h2 className="font-display text-xl uppercase tracking-wider text-gray-700 mb-2">Oeuvres Associees</h2>
              {works.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {works.map((work) => (
                    <div key={work.manga?.mal_id} className="border border-gray-300 px-3 py-2 bg-gray-50">
                      <p className="font-display text-sm uppercase tracking-wider text-gray-700">{work.manga?.title}</p>
                      <p className="font-serif text-xs text-gray-600 mt-1">{work.position}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-serif text-gray-600">Aucune oeuvre associee retournee par l'API.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReadingPersonDetail;
