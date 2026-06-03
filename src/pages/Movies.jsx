import MediaCatalogPage from './MediaCatalogPage';
import { tmdbService } from '../services/tmdb';

function Movies() {
    return <MediaCatalogPage title="Films" initialLetter="F" mediaType="movie" loadPage={tmdbService.getPopularMovies} />;
}

export default Movies;
