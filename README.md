# Movie and TV Series Search Website

This project is a web application that allows users to search, filter, and view information about movies and TV series. The data is retrieved through an API that provides titles, genres, streaming platforms, and other relevant details.
![image](https://github.com/user-attachments/assets/c5beac3d-caca-49bb-b384-a07349952527)


## Features

- **Real-time Search**: Users can search for movies and series by name.
- **Advanced Filtering**: Filter results by genre, streaming platform, and type (movie or series).
- **Detail View**: Displays details such as the original title, description, release date, genres, streaming providers, and star ratings.
- **Pagination**: Navigate between results using next/previous buttons.
- **Modal Window**: Clicking on a movie/series shows more details, including a trailer (if available).
- **Multilingual Support**: Descriptions are available in both English and Spanish, with an option to toggle between languages.

## Technologies Used

- **HTML5, CSS3, and JavaScript**: For the structure and styling of the website.
- **External API**: To fetch information on movies/series, genres, and providers.
- **CSS Grid**: For the layout of movie/series cards.
- **Responsive Design**: The site adapts to mobile and tablet devices.

## Project Structure

### `app.js`
Contains all the application logic, including:

- **API Fetching**: Fetches titles, genres, and streaming providers.
- **Dynamic Rendering**: Creates the movie/series cards and UI elements.
- **Event Handlers**: Manages filter changes and pagination.

### `styles.css`
Defines the visual style of the site, including:

- **Grid Layout**: Organizes the movie/series cards.
- **Modal Styling**: Displays additional details about the selected movie/series.
- **Responsiveness**: Adapts the site to different screen sizes.

## Installation and Usage

1. Clone this repository:
    ```bash
    git clone https://github.com/elgodox/ATV.git
    ```
2. Install the necessary dependencies (if applicable).
3. Run the local server.
4. Open your browser and go to `http://localhost:3000`.

## API Endpoints

### The Movie Database (TMDb) API

- **`/api/providers?type=movie`**: Fetches streaming providers based on the content type (movie or series). Used to display where a title can be watched.
  
- **`/api/genres/{type}`**: Retrieves genres for movies or TV series based on the content type (`movie` or `tv`). This populates the genre filter.

- **`/api/titles`**: Fetches movie or series titles with search parameters, filters (genre, platform, etc.), and pagination. It returns a list of titles based on the user’s search and filter criteria.

- **`/api/titles/details?id={id}&type={type}&language={lang}`**: Fetches detailed information about a specific title (movie or series) in the requested language (`en` for English, `es` for Spanish). Used to display the details in the modal window when a user clicks on a movie/series.

- **`/api/{type}/{movieId}/watch/providers`**: Fetches streaming providers for a specific movie or TV series, checking availability for regions (like Argentina - AR) and offering alternatives if the title is not available locally.

### Torrent Search (1337x or similar)

- **`/api/torrents?movieTitle={movieTitle}`**: Searches for torrents of a specific movie title using the 1337x API (or another torrent site). Returns a list of available torrents sorted by quality (e.g., 4K, 1080p, 720p). This function populates the torrent download buttons within the movie detail modal.


## License

This project is licensed under the MIT License.
