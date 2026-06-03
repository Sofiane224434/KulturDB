import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { useAuth } from '../context/AuthContext';

function VerifyEmail() {
    const [params] = useSearchParams();
    const { loginFromPayload } = useAuth();
    const requestedTokenRef = useRef(null);
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Vérification en cours...');

    useEffect(() => {
        const token = String(params.get('token') || '').trim();
        if (!token) {
            setStatus('error');
            setMessage('Lien invalide: token manquant.');
            return;
        }

        // Avoid duplicate verification requests with the same token after rerenders.
        if (requestedTokenRef.current === token) {
            return;
        }
        requestedTokenRef.current = token;

        authApi
            .verifyEmail(token)
            .then((payload) => {
                loginFromPayload(payload);
                setStatus('success');
                setMessage('Email vérifié. Tu es maintenant connecté.');
            })
            .catch((err) => {
                setStatus('error');
                setMessage(err.message);
            });
    }, [params, loginFromPayload]);

    return (
        <div className="vintage-frame">
            <div className="vintage-frame-top"></div>
            <div className="max-w-xl mx-auto px-4 py-10">
                <h1 className="text-4xl font-display uppercase tracking-wider text-gray-700 mb-6">Vérification email</h1>
                <div
                    className={`p-4 border font-serif ${status === 'success'
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : status === 'error'
                                ? 'border-red-300 bg-red-50 text-red-700'
                                : 'border-gray-300 bg-white text-gray-700'
                        }`}
                >
                    {message}
                </div>

                <Link to="/" className="inline-block mt-6 underline font-serif text-gray-700">
                    Retour à l’accueil
                </Link>
            </div>
            <div className="vintage-frame-bottom"></div>
        </div>
    );
}

export default VerifyEmail;
