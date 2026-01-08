import React, { useEffect, useState } from "react";
import { API_BASE_URL, DEFAULT_PAGE, PAGE_SIZES } from "../api/constants";

interface Movie {
  id: string;
  title: string;
}

interface Hall {
  id: string;
  name: string;
}

interface Session {
  id: string;
  filmId: string;
  hallId: string;
  startAt: string;
  periodicConfig?: {
    period: "EVERY_DAY" | "EVERY_WEEK";
    periodGenerationEndsAt: string;
  } | null;
}

interface SessionsManagementProps {
  token: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

export default function SessionsManagement({ token }: SessionsManagementProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editing, setEditing] = useState<Session | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(
      `${API_BASE_URL}/films?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_FILMS_LOOKUP}`,
      {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMovies(data.data || []))
      .catch(console.error);

    fetch(`${API_BASE_URL}/halls`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setHalls(data.data || []))
      .catch(console.error);
  }, [token]);


  const fetchSessions = () => {
    if (!token) return;
    fetch(
      `${API_BASE_URL}/sessions?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_SESSIONS}`,
      {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setSessions(data.data || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  const handleSave = async (session: Session) => {
    if (!token) return;

    try {
      const method = session.id ? "PUT" : "POST";
      const url = session.id
        ? `${API_BASE_URL}/sessions/${session.id}`
        : `${API_BASE_URL}/sessions`;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filmId: session.filmId,
          hallId: session.hallId,
          startAt: session.startAt,
          periodicConfig: session.periodicConfig || null,
        }),
      });

      if (!res.ok) throw new Error("Ошибка при сохранении сеанса");

      await fetchSessions();
      setEditing(null);
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить сеанс");
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !window.confirm("Удалить этот сеанс?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Ошибка при удалении сеанса");
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить сеанс");
    }
  };

  return (
    <div className="container-fluid">
      <h2 className="text-primary mb-4">🎬 Управление сеансами</h2>

      <button
        className="btn btn-success mb-3"
        onClick={() =>
          setEditing({
            id: "",
            filmId: movies[0]?.id || "",
            hallId: halls[0]?.id || "",
            startAt: new Date().toISOString().slice(0, 16),
            periodicConfig: null,
          })
        }
      >
        ➕ Добавить сеанс
      </button>

      {editing && (
        <SessionForm
          session={editing}
          movies={movies}
          halls={halls}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {sessions.length === 0 ? (
        <p>Сеансов пока нет.</p>
      ) : (
        <div className="row">
          {sessions.map((s) => (
            <div key={s.id} className="col-md-6 mb-3" data-testid={`session-row-${s.id}`}>
              <div className="card shadow-sm p-3 text-light">
                <strong>{movies.find((m) => m.id === s.filmId)?.title || s.filmId}</strong>{" "}
                — <em>{halls.find((h) => h.id === s.hallId)?.name || s.hallId}</em>
                <div>🕒 {new Date(s.startAt).toLocaleString()}</div>
                {s.periodicConfig && (
                  <div className="text-info small mt-1">
                    🔁 {s.periodicConfig.period === "EVERY_DAY" ? "Ежедневно" : "Еженедельно"} до{" "}
                    {new Date(s.periodicConfig.periodGenerationEndsAt).toLocaleDateString("ru-RU")}
                  </div>
                )}
                <div className="mt-2 d-flex justify-content-between">
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() => setEditing(s)}
                  >
                    ✏ Редактировать
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    data-testid={`session-delete-${s.id}`}
                    onClick={() => handleDelete(s.id)}
                  >
                    🗑 Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SessionFormProps {
  session: Session;
  movies: Movie[];
  halls: Hall[];
  onSave: (session: Session) => void;
  onCancel: () => void;
}

function SessionForm({ session, movies, halls, onSave, onCancel }: SessionFormProps) {
  const [form, setForm] = useState(session);
  const [isPeriodic, setIsPeriodic] = useState(false);
  const [period, setPeriod] = useState<"EVERY_DAY" | "EVERY_WEEK">("EVERY_DAY");
  const [periodEnd, setPeriodEnd] = useState("");
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  useEffect(() => {
    if (!periodEnd && isPeriodic && form.startAt) {
      const date = new Date(form.startAt);
      date.setDate(date.getDate() + DAYS_PER_WEEK);
      setPeriodEnd(date.toISOString().slice(0, 16));
    }
  }, [isPeriodic, form.startAt]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  useEffect(() => {
    if (!isPeriodic || !periodEnd) {
      setSessionCount(null);
      return;
    }

    const start = new Date(form.startAt);
    const end = new Date(periodEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      setSessionCount(null);
      return;
    }

    const diffDays = (end.getTime() - start.getTime()) / MS_PER_DAY;
    const count =
      period === "EVERY_DAY"
        ? Math.floor(diffDays) + 1
        : Math.floor(diffDays / DAYS_PER_WEEK) + 1;

    setSessionCount(count);
  }, [form.startAt, periodEnd, period, isPeriodic]);

  return (
    <div className="card p-3 mb-4 shadow-sm">
      <h5 className="mb-3 text-primary">{session.id ? "Редактирование сеанса" : "Новый сеанс"}</h5>

      <select name="filmId" value={form.filmId} onChange={handleChange} className="form-control mb-2">
        {movies.map((m) => (
          <option key={m.id} value={m.id}>{m.title}</option>
        ))}
      </select>

      <select name="hallId" value={form.hallId} onChange={handleChange} className="form-control mb-2">
        {halls.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>

      <label className="text-light ">Дата и время начала:</label>
      <input
        className="form-control mb-3"
        type="datetime-local"
        name="startAt"
        value={form.startAt}
        onChange={handleChange}
      />

      <div className="form-check ">
        <input
          type="checkbox"
          className="form-check-input"
          id="periodicCheck"
          checked={isPeriodic}
          onChange={() => setIsPeriodic(!isPeriodic)}
        />
        <label htmlFor="periodicCheck" className="mb-0 text-light">
          Повторять сеанс
        </label>
      </div>

      {isPeriodic && (
        <>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "EVERY_DAY" | "EVERY_WEEK")}
            className="form-control mb-2"
          >
            <option value="EVERY_DAY">Каждый день</option>
            <option value="EVERY_WEEK">Каждую неделю</option>
          </select>

          <label className="text-light">До даты:</label>
          <input
            className="form-control mb-2"
            type="datetime-local"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />

          {sessionCount && (
            <div className="alert alert-info p-2 mt-2">
              📅 Будет создано <strong>{sessionCount}</strong>{" "}
              {sessionCount === 1 ? "сеанс" : "сеансов"} до{" "}
              {new Date(periodEnd).toLocaleDateString("ru-RU")}
            </div>
          )}
        </>
      )}

      <div className="d-flex justify-content-end mt-3">
        <button
          className="btn btn-success me-2"
          onClick={() =>
            onSave({
              ...form,
              periodicConfig: isPeriodic
                ? {
                    period,
                    periodGenerationEndsAt: new Date(periodEnd).toISOString(),
                  }
                : null,
            } as any)
          }
        >
          💾 Сохранить
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>✖ Отмена</button>
      </div>
    </div>
  );
}
