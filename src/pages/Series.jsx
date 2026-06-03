import MediaCatalogPage from './MediaCatalogPage';
import { tmdbService } from '../services/tmdb';

function Series() {
    return <MediaCatalogPage title="Séries" initialLetter="S" mediaType="series" loadPage={tmdbService.getPopularSeries} />;
}

export default Series;
