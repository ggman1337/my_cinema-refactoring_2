import React, { useEffect, useState } from "react";
import axios from "axios";
import * as userApi from "./api/user";
import { API_BASE_URL, DEFAULT_PAGE, PAGE_SIZES } from "./api/constants";

interface Props {
  token: string; 
}

interface PurchaseResponse {
  id: string;
  clientId: string;
  ticketIds: string[];
  totalCents: number; 
  status: string;
  createdAt: Date;
  filmId: string;
  seats: { row: number; number: number; priceCents: number }[];
}

interface ReviewForm {
  rating: number; 
  text: string; 
}

export default function UserProfilePage({ token }: Props) {
  const [user, setUser] = useState<userApi.User | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    gender: "FEMALE", 
    age: 21, 
  });
  const [editing, setEditing] = useState(false); 

  const [purchases, setPurchases] = useState<PurchaseResponse[]>([]); 
  const [filmTitles, setFilmTitles] = useState<Record<string, string>>({});
  const [reviewForms, setReviewForms] = useState<Record<string, ReviewForm>>({}); 

  
  useEffect(() => {
    async function fetchUser() {
      try {
        const currentUser = await userApi.getCurrentUser(token);
        setUser(currentUser);
        setForm({
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          email: currentUser.email,
          gender: currentUser.gender === "FEMALE" ? "Женский" : "Мужской",
          age: currentUser.age,
        });
      } catch (err) {
        console.error("Ошибка загрузки профиля:", err);
        alert("Ошибка загрузки профиля"); 
      }
    }
    fetchUser();
  }, [token]);

  
  useEffect(() => {
    async function fetchPurchases() {
      try {
        const res = await axios.get(`${API_BASE_URL}/purchases`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: DEFAULT_PAGE, size: PAGE_SIZES.PURCHASES }, 
        });

        const mapped: PurchaseResponse[] = res.data.data.map((p: any) => ({
          id: p.id,
          clientId: p.clientId,
          ticketIds: p.ticketIds,
          totalCents: p.totalCents,
          status: p.status,
          createdAt: new Date(p.createdAt),
          filmId: p.filmId,
          seats: p.seats || [], 
        }));

        setPurchases(mapped);

        const uniqueIds = [...new Set(mapped.map((p) => p.filmId))];
        const filmData: Record<string, string> = {};

        await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              const filmRes = await axios.get(`${API_BASE_URL}/films/${id}`);
              filmData[id] = filmRes.data.title;
            } catch {
              filmData[id] = "Неизвестный фильм"; 
            }
          })
        );

        setFilmTitles(filmData);
      } catch (err) {
        console.error("Ошибка загрузки покупок:", err);
      }
    }

    fetchPurchases();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === "age" ? Number(value) : value });
  };

  
  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const updated = await userApi.updateCurrentUser(token, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        age: form.age,
        gender: form.gender === "Женский" ? "FEMALE" : "MALE",
      });
      setUser(updated);
      setEditing(false);
      alert("Профиль обновлен!"); 
    } catch (err) {
      console.error("Ошибка обновления профиля:", err);
      alert("Ошибка обновления профиля"); 
    }
  };

  const handleReviewChange = (filmId: string, field: "rating" | "text", value: string | number) => {
    setReviewForms((prev) => ({
      ...prev,
      [filmId]: { ...prev[filmId], [field]: value },
    }));
  };

  
  const handleSubmitReview = async (filmId: string) => {
    const review = reviewForms[filmId];
    if (!review || !review.rating || !review.text) return alert("Заполните рейтинг и текст отзыва");

    try {
      await axios.post(
        `${API_BASE_URL}/films/${filmId}/reviews`,
        { rating: review.rating, text: review.text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Отзыв отправлен!"); 
      setReviewForms((prev) => ({ ...prev, [filmId]: { rating: 0, text: "" } }));
    } catch (err) {
      console.error("Ошибка отправки отзыва:", err);
      alert("Не удалось отправить отзыв"); 
    }
  };

  if (!user) return <div className="text-center text-light mt-5">Загрузка профиля...</div>;

  return (
    <div className="min-vh-100 bg-dark text-light p-4">
      
      <div className="card text-dark mb-4">
        <div className="card-body">
          <h2 className="card-title text-primary mb-3">Профиль</h2>
          {editing ? (
            <>
              <input className="form-control mb-2" name="firstName" value={form.firstName} onChange={handleChange} placeholder="Имя" />
              <input className="form-control mb-2" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Фамилия" />
              <input className="form-control mb-2" name="email" value={form.email} onChange={handleChange} placeholder="Email" />
              <select className="form-control mb-2" name="gender" value={form.gender} onChange={handleChange}>
                <option>Женский</option>
                <option>Мужской</option>
              </select>
              <input className="form-control mb-2" name="age" type="number" value={form.age} onChange={handleChange} placeholder="Возраст" />
              <button className="btn btn-success me-2" onClick={handleSaveProfile}>Сохранить</button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Отмена</button>
            </>
          ) : (
            <>
              <p className="text-light">Имя: {form.firstName}</p>
              <p className="text-light">Фамилия: {form.lastName}</p>
              <p className="text-light">Email: {form.email}</p>
              <p className="text-light">Пол: {form.gender}</p>
              <p className="text-light">Возраст: {form.age}</p>
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Редактировать</button>
            </>
          )}
        </div>
      </div>

      
      <div className="mb-4">
        <h2 className="text-primary mb-3">История покупок</h2>
        {purchases.length === 0 ? (
          <p>У вас пока нет покупок 🎟️</p> 
        ) : (
          purchases.map((p: PurchaseResponse) => (
            <div key={p.id} className="card text-dark mb-3">
              <div className="card-body text-light">
                <strong>{filmTitles[p.filmId as string] || "Загрузка..."}</strong>
                <br />
                Итого: {p.totalCents}₽ 
                <br />
                Статус: {p.status} 

                <div className="mt-2">
                  <h6>Оставить отзыв:</h6>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    className="form-control mb-1"
                    placeholder="Рейтинг 0–5"
                    value={reviewForms[p.filmId as string]?.rating || ""}
                    onChange={(e) => handleReviewChange(p.filmId, "rating", Number(e.target.value))}
                  />
                  <input
                    type="text"
                    className="form-control mb-1"
                    placeholder="Текст отзыва"
                    value={reviewForms[p.filmId as string]?.text || ""}
                    onChange={(e) => handleReviewChange(p.filmId, "text", e.target.value)}
                  />
                  <button className="btn btn-success" onClick={() => handleSubmitReview(p.filmId)}>
                    Отправить отзыв
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
