import { BrowserRouter as Router, Link, Navigate, Routes, Route, useNavigate } from 'react-router-dom';
import LateralNav from './components/LateralNav';
import Footer from './components/Footer';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Anime from './pages/Anime';
import Manga from './pages/Manga';
import Manwha from './pages/Manwha';
import LightNovels from './pages/LightNovels';
import Romans from './pages/Romans';
import ReadingDetail from './pages/ReadingDetail';
import ReadingPersonDetail from './pages/ReadingPersonDetail';
import MovieDetail from './pages/MovieDetail';
import SeriesDetail from './pages/SeriesDetail';
import PersonDetail from './pages/PersonDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import OAuthSuccess from './pages/OAuthSuccess';
import Library from './pages/Library';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

function TopAuthActions() {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuth();

    if (isAuthenticated) {
        return (
            <div className="flex items-center justify-end gap-3 px-4 pt-4 pb-2 md:px-8">
                <span className="hidden sm:inline text-xs md:text-sm font-serif text-gray-600">
                    Connecté: <span className="text-gray-900">{user?.displayName || user?.email}</span>
                </span>
                <button
                    onClick={() => {
                        logout();
                        navigate('/');
                    }}
                    className="px-3 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs md:text-sm"
                >
                    Déconnexion
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-end gap-3 px-4 pt-4 pb-2 md:px-8">
            <Link
                to="/login"
                className="px-3 py-2 border border-gray-400 text-gray-700 bg-white font-display uppercase tracking-wider text-xs md:text-sm hover:bg-gray-100"
            >
                Connexion
            </Link>
            <Link
                to="/register"
                className="px-3 py-2 bg-black text-gray-300 border border-gray-800 font-display uppercase tracking-wider text-xs md:text-sm hover:bg-gray-900"
            >
                Inscription
            </Link>
        </div>
    );
}

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-[#f5f5f0] text-gray-900 font-serif">
                <div className="flex flex-col md:flex-row md:items-start md:min-h-screen">
                    <main className="flex-1 min-w-0 order-2 md:order-1">
                        <TopAuthActions />
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/movies" element={<Movies />} />
                            <Route path="/series" element={<Series />} />
                            <Route path="/anime" element={<Anime />} />
                            <Route path="/manga" element={<Manga />} />
                            <Route path="/manwha" element={<Manwha />} />
                            <Route path="/light-novels" element={<LightNovels />} />
                            <Route path="/romans" element={<Romans />} />
                            <Route path="/reading/:type/:id" element={<ReadingDetail />} />
                            <Route path="/reading/person/:id" element={<ReadingPersonDetail />} />
                            <Route path="/movie/:id" element={<MovieDetail />} />
                            <Route path="/series/:id" element={<SeriesDetail />} />
                            <Route path="/person/:id" element={<PersonDetail />} />
                            <Route path="/favorites" element={<Navigate to="/library" replace />} />
                            <Route path="/watchlist" element={<Navigate to="/library" replace />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/auth/verify-email" element={<VerifyEmail />} />
                            <Route path="/auth/oauth-success" element={<OAuthSuccess />} />
                        </Routes>
                    </main>
                    <LateralNav />
                </div>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
