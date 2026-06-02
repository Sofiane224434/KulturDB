import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from './config.js';
import {
    createOAuthUser,
    findUserByEmail,
    findUserByOauth,
} from '../services/userRepository.js';

export function initPassport() {
    const hasGoogle = Boolean(config.googleClientId && config.googleClientSecret);
    const hasGithub = Boolean(config.githubClientId && config.githubClientSecret);

    if (!hasGoogle && !hasGithub) {
        return;
    }

    if (hasGoogle) {
        passport.use(
            new GoogleStrategy(
                {
                    clientID: config.googleClientId,
                    clientSecret: config.googleClientSecret,
                    callbackURL: config.googleCallbackUrl,
                },
                async (_accessToken, _refreshToken, profile, done) => {
                    try {
                        const email = profile.emails?.[0]?.value;
                        if (!email) {
                            return done(new Error('Google account has no email.'));
                        }

                        let user = findUserByOauth('google', profile.id);
                        if (!user) {
                            const existingUser = findUserByEmail(email);
                            if (existingUser) {
                                user = existingUser;
                            } else {
                                user = createOAuthUser({
                                    email,
                                    displayName: profile.displayName || email.split('@')[0],
                                    provider: 'google',
                                    oauthId: profile.id,
                                    emailVerified: true,
                                });
                            }
                        }

                        return done(null, user);
                    } catch (error) {
                        return done(error);
                    }
                },
            ),
        );
    }

    if (hasGithub) {
        passport.use(
            new GitHubStrategy(
                {
                    clientID: config.githubClientId,
                    clientSecret: config.githubClientSecret,
                    callbackURL: config.githubCallbackUrl,
                },
                async (_accessToken, _refreshToken, profile, done) => {
                    try {
                        const email =
                            profile.emails?.[0]?.value ||
                            `${profile.id}@users.noreply.github.com`;

                        let user = findUserByOauth('github', profile.id);
                        if (!user) {
                            const existingUser = findUserByEmail(email);
                            if (existingUser) {
                                user = existingUser;
                            } else {
                                user = createOAuthUser({
                                    email,
                                    displayName:
                                        profile.displayName ||
                                        profile.username ||
                                        email.split('@')[0],
                                    provider: 'github',
                                    oauthId: profile.id,
                                    emailVerified: true,
                                });
                            }
                        }

                        return done(null, user);
                    } catch (error) {
                        return done(error);
                    }
                },
            ),
        );
    }

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
        done(null, { id });
    });
}
