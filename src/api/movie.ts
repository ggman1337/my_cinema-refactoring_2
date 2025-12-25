import { getCurrentUser } from "./auth";
import { API_BASE_URL } from "./constants";

export interface Film {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  ageRating: string;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  genre?: string;
}

export interface FilmResponse {
  data: Film[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const MOCK_FILMS: Film[] = [
  {
    id: "1",
    title: "Интерстеллар",
    description: "Фантастический фильм о путешествиях во времени и пространстве.",
    durationMinutes: 169,
    ageRating: "12+",
    imageUrl: "https://via.placeholder.com/150",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Начало",
    description: "Фильм о снах и подсознании, режиссёр Кристофер Нолан.",
    durationMinutes: 148,
    ageRating: "12+",
    imageUrl: "https://via.placeholder.com/150",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];


export async function getFilms(): Promise<Film[]> {
  const res = await fetch(`${API_BASE_URL}/films`);
  if (!res.ok) throw new Error("Ошибка загрузки фильмов");
  const json: FilmResponse = await res.json();
  return json.data;
  return new Promise(resolve => setTimeout(() => resolve(MOCK_FILMS), 300));
  
}

export async function getFilmById(id: string): Promise<Film> {
  const res = await fetch(`${API_BASE_URL}/films/${id}`);
  if (!res.ok) throw new Error("Фильм не найден");
  return res.json();
}
