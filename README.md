# Movie and TV Series Search Website

This project is a web application that allows users to search, filter, and view information about movies and TV series. The data is retrieved through an API that provides titles, genres, streaming platforms, and other relevant details.

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

- `/api/providers?type=movie`: Fetches streaming providers based on content type.
- `/api/genres/{type}`: Retrieves genres for movies or TV series.
- `/api/titles`: Fetches movie or series titles with search parameters, filters, and pagination.
- `/api/titles/details?id={id}&language={lang}`: Fetches details of a title in the specified language.

## License

This project is licensed under the MIT License.
