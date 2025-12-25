import React, { useState, useEffect } from "react";
import * as movieApi from "./api/movie";
import MovieCard from "./MovieCard";
import MovieDetailsPage from "./MovieDetailsPage";


let globalLoadingState = false;

export default function HomePage() {
  const [films, setFilms] = useState<movieApi.Film[]>([]); 
  const [selectedFilm, setSelectedFilm] = useState<movieApi.Film | null>(null); 
  const [cachedFilms, setCachedFilms] = useState<movieApi.Film[]>([]); 
  const [viewCount, setViewCount] = useState(0); 

  
  useEffect(() => {
    globalLoadingState = true; 
    
    movieApi.getFilms()
      .then(filmsData => {
        setFilms(filmsData); 
        setCachedFilms(filmsData); 
        globalLoadingState = false; 
        
        
        setViewCount(prev => prev + 1);
      })
      .catch(error => {
        console.error("Ошибка загрузки фильмов:", error); 
        globalLoadingState = false; 
      });
  }, []); 

  
  const handleFilmSelect = (film: movieApi.Film) => {
    setSelectedFilm(film); 
    setViewCount(prev => prev + 1); 
  };

  
  const handleBackFromDetails = () => {
    setSelectedFilm(null); 
    setViewCount(prev => prev + 1); 
  };

  
  
  
  if (selectedFilm) {
    return (
      <MovieDetailsPage
        movie={selectedFilm} 
        onBack={handleBackFromDetails} 
      />
    );
  }

  
  const renderMovieCards = () => {
    return films.map((film) => (
      <MovieCard
        key={film.id} 
        movie={film} 
        onSelect={() => handleFilmSelect(film)} 
      />
    ));
  };

  
  
  return (
    <div className="container py-5 d-flex flex-wrap gap-4 justify-content-center">
      {renderMovieCards()}
    </div>
  );
}