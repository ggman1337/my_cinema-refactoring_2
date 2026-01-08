import React, { useState, useEffect } from "react";
import MoviesManagement from "./MoviesManagement";
import HallsManagement from "./HallsManagement";
import CategoriesManagement from "./CategoriesManagement";
import SessionsManagement from "./SessionsManagement";

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminPanelProps) {
  const [section, setSection] = useState<"movies" | "halls" | "categories" | "sessions">("movies");
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
  }, []);

  if (!token) {
    return (
      <div className="container p-4">
        <p className="text-danger">Требуется авторизация. Пожалуйста, войдите.</p>
        <button className="btn btn-primary" onClick={onBack}>
          ⬅ Назад
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex min-vh-100 bg-dark text-light">
      <div
        className="p-4 border-end border-secondary"
        style={{ width: "250px", backgroundColor: "#1f1f1f" }}
      >
        <h3 className="text-primary mb-4 text-center">🎬 Админ Панель</h3>
        <ul className="list-unstyled">
          <li className="mb-2">
            <button
              className={`btn w-100 ${section === "movies" ? "btn-primary" : "btn-outline-light"}`}
              data-testid="admin-nav-movies"
              onClick={() => setSection("movies")}
            >
              Фильмы
            </button>
          </li>
          <li className="mb-2">
            <button
              className={`btn w-100 ${section === "halls" ? "btn-primary" : "btn-outline-light"}`}
              onClick={() => setSection("halls")}
            >
              Залы
            </button>
          </li>
          <li className="mb-2">
            <button
              className={`btn w-100 ${section === "categories" ? "btn-primary" : "btn-outline-light"}`}
              data-testid="admin-nav-categories"
              onClick={() => setSection("categories")}
            >
              Категории
            </button>
          </li>
          <li className="mb-2">
            <button
              className={`btn w-100 ${section === "sessions" ? "btn-primary" : "btn-outline-light"}`}
              data-testid="admin-nav-sessions"
              onClick={() => setSection("sessions")}
            >
              Сеансы
            </button>
          </li>
        </ul>
    
      </div>

      <div className="flex-grow-1 bg-light text-dark p-4 overflow-auto">
        {section === "movies" && <MoviesManagement token={token} />}
        {section === "halls" && <HallsManagement token={token} />}
        {section === "categories" && <CategoriesManagement token={token} />}
                {section === "sessions" && <SessionsManagement token={token} />}
      </div>
    </div>
  );
}
