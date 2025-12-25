import React, { useEffect, useState } from "react";
import { API_BASE_URL, DEFAULT_PAGE, PAGE_SIZES } from "../api/constants";

interface Seat {
  row: number;
  number: number;
  categoryId: string;
}

interface Row {
  id: number;
  rowNumber: number;
  seatsCount: number;
  categoryId: string;
}

interface Hall {
  id?: string;
  name: string;
  number: number;
  rows: Row[];
}

interface SeatCategory {
  id: string;
  name: string;
}

interface HallsManagementProps {
  token: string;
}

export default function HallsManagement({ token }: HallsManagementProps) {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [editing, setEditing] = useState<Hall | null>(null);
  const [categories, setCategories] = useState<SeatCategory[]>([]);

  // ✅ Загрузка залов
  const fetchHalls = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/halls`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const safeHalls = (data.data || []).map((h: any) => ({
        ...h,
        rows: h.rows || [],
      }));
      setHalls(safeHalls);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Загрузка категорий мест
  const fetchCategories = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/seat-categories?page=${DEFAULT_PAGE}&size=${PAGE_SIZES.ADMIN_SEAT_CATEGORIES}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setCategories(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHalls();
    fetchCategories();
  }, [token]);

  // ✅ Сохранение зала
  const handleSave = async (hall: Hall) => {
    if (!token) return;
    try {
      const method = hall.id ? "PUT" : "POST";
      const url = hall.id
        ? `${API_BASE_URL}/halls/${hall.id}`
        : `${API_BASE_URL}/halls`;

      // 🔹 Генерируем плоский массив мест
      const seats: Seat[] = [];
      hall.rows.forEach((row, i) => {
        for (let j = 0; j < row.seatsCount; j++) {
          seats.push({
            row: i + 1,
            number: j + 1,
            categoryId: row.categoryId,
          });
        }
      });

      const safeHall = {
        name: hall.name,
        number: hall.number,
        rows: hall.rows.length,
        seats,
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(safeHall),
      });

      if (!res.ok) throw new Error("Ошибка при сохранении зала");
      await fetchHalls();
      setEditing(null);
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить зал");
    }
  };

  // ✅ Удаление зала
  const handleDelete = async (id: string) => {
    if (!token || !window.confirm("Удалить этот зал?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/halls/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Ошибка при удалении зала");
      setHalls(halls.filter((h) => h.id !== id));
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить зал");
    }
  };

  return (
    <div className="container-fluid">
      <h2 className="text-primary mb-4">Управление залами</h2>

      <button
        className="btn btn-success mb-3"
        onClick={() =>
          setEditing({ name: "", number: 1, rows: [] })
        }
      >
        ➕ Добавить зал
      </button>

      {editing && (
        <HallForm
          hall={editing}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {halls.length === 0 ? (
        <p>Залов пока нет.</p>
      ) : (
        <div className="row">
          {halls.map((h) => (
            <div key={h.id} className="col-md-6 mb-3">
              <div className="card shadow-sm p-3 text-light">
                <strong>{h.name}</strong> — №{h.number} | {h.rows.length} рядов
                <div className="mt-2 d-flex justify-content-between">
                  <button className="btn btn-warning btn-sm" onClick={() => setEditing(h)}>
                    Редактировать
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(h.id!)}>
                    Удалить
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


interface HallFormProps {
  hall: Hall;
  categories: SeatCategory[];
  onSave: (hall: Hall) => void;
  onCancel: () => void;
}

function HallForm({ hall, categories, onSave, onCancel }: HallFormProps) {
  const [form, setForm] = useState<Hall>({ ...hall, rows: hall.rows || [] });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === "number" ? Number(value) : value });
  };

  const addRow = () => {
    setForm({
      ...form,
      rows: [
        ...form.rows,
        { id: Date.now(), rowNumber: form.rows.length + 1, seatsCount: 1, categoryId: categories[0]?.id || "" },
      ],
    });
  };

  const removeRow = (id: number) => {
    setForm({ ...form, rows: form.rows.filter((r) => r.id !== id) });
  };

  const handleRowChange = (id: number, seatsCount: number, categoryId: string) => {
    setForm({
      ...form,
      rows: form.rows.map((r) =>
        r.id === id ? { ...r, seatsCount, categoryId } : r
      ),
    });
  };

  return (
    <div className="card p-3 mb-4 shadow-sm">
      <h5 className="mb-3 text-primary">{hall.id ? "Редактирование зала" : "Новый зал"}</h5>

      <input className="form-control mb-2 " name="name" value={form.name} onChange={handleChange} placeholder="Название зала" />
      <input className="form-control mb-2" name="number" type="number" value={form.number} onChange={handleChange} placeholder="Номер зала" />

      <h6 className="text-light">Ряды и количество мест:</h6>
      {form.rows.map((row) => (
        <div key={row.id} className="d-flex align-items-center mb-2">
          <span className="me-2 text-light ">Ряд {row.rowNumber}:</span>
          <input
            type="number"
            className="form-control me-2"
            style={{ width: "100px" }}
            value={row.seatsCount}
            onChange={(e) =>
              handleRowChange(row.id, Number(e.target.value), row.categoryId)
            }
          />
          <select
            className="form-control me-2"
            style={{ width: "200px" }}
            value={row.categoryId}
            onChange={(e) =>
              handleRowChange(row.id, row.seatsCount, e.target.value)
            }
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn-sm btn-danger" onClick={() => removeRow(row.id)}>✖</button>
        </div>
      ))}

      <button className="btn btn-outline-primary mb-3" onClick={addRow}>➕ Добавить ряд</button>

      <div className="d-flex justify-content-end">
        <button className="btn btn-success me-2" onClick={() => onSave(form)}>💾 Сохранить</button>
        <button className="btn btn-secondary" onClick={onCancel}>✖ Отмена</button>
      </div>
    </div>
  );
}
