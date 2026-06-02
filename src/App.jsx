import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LateralNav from './components/LateralNav';
import Footer from './components/Footer';
import Home from './pages/Home';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Anime from './pages/Anime';
import MovieDetail from './pages/MovieDetail';
import SeriesDetail from './pages/SeriesDetail';
import PersonDetail from './pages/PersonDetail';
import Favorites from './pages/Favorites';
import Watchlist from './pages/Watchlist';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import OAuthSuccess from './pages/OAuthSuccess';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-[#f5f5f0] text-gray-900 font-serif overflow-x-hidden">
                <div className="flex flex-col md:flex-row">
                    <main className="flex-1 min-w-0 order-2 md:order-1">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/movies" element={<Movies />} />
                            <Route path="/series" element={<Series />} />
                            <Route path="/anime" element={<Anime />} />
                            <Route path="/movie/:id" element={<MovieDetail />} />
                            <Route path="/series/:id" element={<SeriesDetail />} />
                            <Route path="/person/:id" element={<PersonDetail />} />
                            <Route
                                path="/favorites"
                                element={
                                    <ProtectedRoute>
                                        <Favorites />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/watchlist"
                                element={
                                    <ProtectedRoute>
                                        <Watchlist />
                                    </ProtectedRoute>
                                }
                            />
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
