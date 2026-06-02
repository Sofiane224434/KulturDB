import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';

function OAuthSuccess() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { loginFromPayload } = useAuth();

    useEffect(() => {
        const token = params.get('token');
        const redirectTo = params.get('redirect') || '/';
        if (!token) {
            navigate('/login?error=oauth_missing_token');
            return;
        }

        localStorage.setItem('authToken', token);
        authApi
            .me()
            .then((res) => {
                loginFromPayload({ token, user: res.user });
                navigate(redirectTo);
            })
            .catch(() => {
                localStorage.removeItem('authToken');
                navigate('/login?error=oauth_invalid_token');
            });
    }, [params, navigate, loginFromPayload]);

    return (
        <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-transparent"></div>
            <p className="mt-4 font-display text-2xl text-gray-500 uppercase tracking-widest">Connexion OAuth...</p>
        </div>
    );
}

export default OAuthSuccess;
