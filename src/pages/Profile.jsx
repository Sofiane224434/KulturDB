import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="vintage-frame">
      <div className="vintage-frame-top"></div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-12 md:py-20">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-display uppercase tracking-wider text-gray-600 mb-6">
          Mon profil
        </h1>

        {isAuthenticated ? (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="text-sm uppercase tracking-widest text-gray-500 font-display mb-2">Compte connecté</p>
            <p className="text-2xl md:text-3xl font-display uppercase tracking-wider text-gray-700 mb-3">
              {user?.displayName || 'Utilisateur'}
            </p>
            <p className="font-serif text-gray-600 mb-8">{user?.email}</p>

            <div className="flex flex-wrap gap-3">
              <Link to="/library" className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm">
                Ma bibliothèque
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100"
              >
                Déconnexion
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-gray-300 bg-white p-6 md:p-10">
            <p className="font-serif text-xl text-gray-600 mb-4">Vous n’êtes pas connecté.</p>
            <p className="font-serif text-gray-500 mb-6">Connectez-vous pour retrouver votre profil et gérer votre compte.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="px-4 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-sm">
                Connexion
              </Link>
              <Link to="/register" className="px-4 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-sm hover:bg-gray-100">
                Inscription
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="vintage-frame-bottom"></div>
    </div>
  );
}

export default Profile;