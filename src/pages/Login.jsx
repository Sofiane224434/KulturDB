import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { useAuth } from '../context/AuthContext';

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const { isAuthenticated, loginFromPayload } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [googleEnabled, setGoogleEnabled] = useState(false);
    const [githubEnabled, setGithubEnabled] = useState(false);

    const redirectTo = location.state?.from?.pathname || '/';

    useEffect(() => {
        authApi
            .oauthProviders()
            .then((data) => {
                setGoogleEnabled(Boolean(data.google));
                setGithubEnabled(Boolean(data.github));
            })
            .catch(() => {
                setGoogleEnabled(false);
                setGithubEnabled(false);
            });
    }, []);

    useEffect(() => {
        const oauthError = params.get('error');
        if (oauthError) {
            setError('Connexion OAuth impossible. Réessaie.');
        }
    }, [params]);

    useEffect(() => {
        if (isAuthenticated) {
            navigate(redirectTo);
        }
    }, [isAuthenticated, navigate, redirectTo]);

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const payload = await authApi.login({
                email: email.trim().toLowerCase(),
                password,
            });
            loginFromPayload(payload);
            navigate(redirectTo);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            <div className="max-w-xl mx-auto px-4 py-10">
                <h1 className="text-4xl font-display uppercase tracking-wider text-gray-700 mb-6">Connexion</h1>

                {error && <div className="mb-4 p-3 border border-red-300 bg-red-50 text-red-700 font-serif">{error}</div>}
                {message && <div className="mb-4 p-3 border border-green-300 bg-green-50 text-green-700 font-serif">{message}</div>}

                <form onSubmit={onSubmit} className="space-y-4 border-2 border-gray-300 bg-white p-6">
                    <div>
                        <label className="block mb-1 font-display uppercase tracking-wider text-sm text-gray-600">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-400 px-3 py-2 font-serif"
                            required
                        />
                    </div>

                    <div>
                        <label className="block mb-1 font-display uppercase tracking-wider text-sm text-gray-600">Mot de passe</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-400 px-3 py-2 font-serif"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-2 bg-black text-gray-300 font-display uppercase tracking-wider border border-gray-800 disabled:opacity-50"
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>

                {googleEnabled && (
                    <a
                        href={authApi.getGoogleOAuthUrl(redirectTo)}
                        className="mt-4 w-full block text-center px-4 py-2 bg-white border-2 border-gray-800 text-gray-700 font-display uppercase tracking-wider hover:bg-gray-100"
                    >
                        Continuer avec Google
                    </a>
                )}

                {githubEnabled && (
                    <a
                        href={authApi.getGithubOAuthUrl(redirectTo)}
                        className="mt-3 w-full block text-center px-4 py-2 bg-black border-2 border-gray-800 text-gray-300 font-display uppercase tracking-wider hover:bg-gray-900"
                    >
                        Continuer avec GitHub
                    </a>
                )}

                {!googleEnabled && !githubEnabled && (
                    <div className="mt-4 p-3 border border-gray-300 bg-white text-gray-600 font-serif text-sm">
                        OAuth est disponible, mais pas encore configuré sur le serveur (Google/GitHub).
                    </div>
                )}

                <p className="mt-4 font-serif text-gray-600">
                    Pas encore de compte ?{' '}
                    <Link to="/register" className="underline text-gray-800">
                        Créer un compte
                    </Link>
                </p>
            </div>
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default Login;
