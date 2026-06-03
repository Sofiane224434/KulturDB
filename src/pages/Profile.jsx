import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-8 md:py-12">
        <header className="mb-8 md:mb-10">
          <p className="text-xs font-display uppercase tracking-[0.35em] text-gray-500 mb-3">Compte</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-3">
            Mon Profil
          </h1>
          <p className="font-serif text-gray-600">
            Gerez votre compte et retrouvez vos contenus suivis.
          </p>
        </header>

        <section className="grid md:grid-cols-[320px_1fr] gap-6 md:gap-8">
          <div className="border-2 border-gray-300 bg-white p-6">
            <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-2">Nom</p>
            <p className="font-display text-2xl uppercase tracking-wider text-gray-800 mb-5">
              {user?.displayName || 'Utilisateur'}
            </p>

            <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-2">Email</p>
            <p className="font-serif text-gray-700 mb-5 break-all">
              {user?.email || 'Non renseigne'}
            </p>

            <p className="text-xs font-display uppercase tracking-wider text-gray-500 mb-2">Connexion</p>
            <p className="font-serif text-gray-700 mb-6">
              {user?.provider || 'Locale'}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs"
              >
                Deconnexion
              </button>
              <Link
                to="/library"
                className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-xs hover:bg-gray-100"
              >
                Ma Bibliotheque
              </Link>
            </div>
          </div>

          <div className="border-2 border-gray-300 bg-white p-6 md:p-8">
            <h2 className="font-display text-2xl uppercase tracking-wider text-gray-700 mb-4">
              Raccourcis
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link to="/library" className="border-2 border-gray-800 bg-gray-900 text-gray-100 p-4 hover:bg-gray-800 transition-colors">
                <p className="font-display uppercase tracking-wider text-sm mb-2">Ma Bibliotheque</p>
                <p className="font-serif text-sm text-gray-300">Suivi de vos films, series, animes et lectures.</p>
              </Link>
              <Link to="/movies" className="border-2 border-gray-800 bg-gray-900 text-gray-100 p-4 hover:bg-gray-800 transition-colors">
                <p className="font-display uppercase tracking-wider text-sm mb-2">Explorer</p>
                <p className="font-serif text-sm text-gray-300">Reprendre la navigation dans le catalogue public.</p>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default Profile;
