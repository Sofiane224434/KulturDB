import MediaCatalogPage from './MediaCatalogPage';
import { tmdbService } from '../services/tmdb';

function Anime() {
    return <MediaCatalogPage title="Anime" initialLetter="A" mediaType="anime" loadPage={tmdbService.getAnime} />;
}

export default Anime;
