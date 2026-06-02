import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi } from '../services/authApi';

function Register() {
    const location = useLocation();
    const [displayName, setDisplayName] = useState('');
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

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const res = await authApi.register({ displayName, email, password });
            setMessage(res.message || 'Compte créé. Vérifie ton email.');
            setPassword('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        setError('');
        setMessage('');
        if (!email) {
            setError('Entre ton email pour renvoyer la vérification.');
            return;
        }
        try {
            const res = await authApi.resendVerification(email);
            setMessage(res.message);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            <div className="max-w-xl mx-auto px-4 py-10">
                <h1 className="text-4xl font-display uppercase tracking-wider text-gray-700 mb-6">Créer un compte</h1>

                {error && <div className="mb-4 p-3 border border-red-300 bg-red-50 text-red-700 font-serif">{error}</div>}
                {message && <div className="mb-4 p-3 border border-green-300 bg-green-50 text-green-700 font-serif">{message}</div>}

                <div className="mb-4 border-2 border-gray-300 bg-white p-4">
                    <p className="mb-3 text-xs font-display uppercase tracking-wider text-gray-600">Inscription rapide</p>
                    {googleEnabled && (
                        <a
                            href={authApi.getGoogleOAuthUrl(redirectTo)}
                            className="w-full block text-center px-4 py-2 bg-white border-2 border-gray-800 text-gray-700 font-display uppercase tracking-wider hover:bg-gray-100"
                        >
                            S'inscrire avec Google
                        </a>
                    )}

                    {githubEnabled && (
                        <a
                            href={authApi.getGithubOAuthUrl(redirectTo)}
                            className="mt-3 w-full block text-center px-4 py-2 bg-black border-2 border-gray-800 text-gray-300 font-display uppercase tracking-wider hover:bg-gray-900"
                        >
                            S'inscrire avec GitHub
                        </a>
                    )}

                    {!googleEnabled && !githubEnabled && (
                        <div className="p-3 border border-gray-300 bg-white text-gray-600 font-serif text-sm">
                            Inscription OAuth non disponible pour le moment (Google/GitHub).
                        </div>
                    )}
                </div>

                <form onSubmit={onSubmit} className="space-y-4 border-2 border-gray-300 bg-white p-6">
                    <div>
                        <label className="block mb-1 font-display uppercase tracking-wider text-sm text-gray-600">Pseudo</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full border border-gray-400 px-3 py-2 font-serif"
                            required
                        />
                    </div>

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
                            minLength={8}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-2 bg-black text-gray-300 font-display uppercase tracking-wider border border-gray-800 disabled:opacity-50"
                    >
                        {loading ? 'Création...' : 'Créer mon compte'}
                    </button>
                </form>

                <button onClick={resend} className="mt-4 w-full px-4 py-2 bg-white border border-gray-400 text-gray-700 font-serif">
                    Renvoyer l’email de vérification
                </button>

                <p className="mt-4 font-serif text-gray-600">
                    Déjà un compte ?{' '}
                    <Link to="/login" className="underline text-gray-800">
                        Se connecter
                    </Link>
                </p>
            </div>
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default Register;
