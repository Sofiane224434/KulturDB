import { Link } from 'react-router-dom';

function Footer() {
    return (
        <footer className="bg-white mt-auto">
            <div className="h-6 mx-auto border2-separator"></div>
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* KulturDB Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-3xl font-display uppercase tracking-widest text-gray-700">
                                <span className="text-4xl">K</span>ultur<span className="text-4xl">D</span><span className="text-4xl">B</span>
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600 font-serif leading-relaxed">
                            Votre destination pour découvrir et explorer l'univers du cinéma et des séries.
                        </p>
                    </div>

                    {/* Navigation Section */}
                    <div>
                        <h4 className="font-display uppercase tracking-widest text-gray-700 mb-6 text-sm border-b border-gray-300 pb-2 inline-block">Navigation</h4>
                        <ul className="space-y-3 text-sm text-gray-600 font-serif">
                            <li><Link to="/movies" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Films</Link></li>
                            <li><Link to="/series" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Séries</Link></li>
                            <li><Link to="/anime" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Anime</Link></li>
                            <li><Link to="/library" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Ma Bibliothèque</Link></li>
                            <li><Link to="/profile" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Mon profil</Link></li>
                        </ul>
                    </div>

                    {/* Lecture */}
                    <div>
                        <h4 className="font-display uppercase tracking-widest text-gray-700 mb-6 text-sm border-b border-gray-300 pb-2 inline-block">Lecture</h4>
                        <ul className="space-y-3 text-sm text-gray-600 font-serif">
                            <li><Link to="/manga" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Mangas</Link></li>
                            <li><Link to="/manwha" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Manwha</Link></li>
                            <li><Link to="/light-novels" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Light Novels</Link></li>
                            <li><Link to="/romans" className="hover:text-gray-900 uppercase tracking-wider transition-colors">Romans</Link></li>
                        </ul>
                    </div>

                    {/* Ressources */}
                    <div>
                        <h4 className="font-display uppercase tracking-widest text-gray-700 mb-6 text-sm border-b border-gray-300 pb-2 inline-block">Ressources</h4>
                        <ul className="space-y-3 text-sm text-gray-600 font-serif">
                            <li><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 uppercase tracking-wider transition-colors">TMDB</a></li>
                            <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 uppercase tracking-wider transition-colors">GitHub</a></li>
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-12 pt-8 border-t border-gray-300 text-center">
                    <p className="text-xs tracking-[0.2em] uppercase text-gray-600 font-serif">© 2026 KulturDB. Tous droits réservés.</p>
                </div>
            </div>
        </footer>
    )
}

export default Footer;