import React, { useEffect, useState } from "react";
import axios from "axios";
import * as movieApi from "./api/movie";
import { API_BASE_URL, DEFAULT_PAGE, PAGE_SIZES } from "./api/constants";
import ReviewsDisplay from "./ReviewsDisplay";

// Интерфейсы - потому что TypeScript не доверяет нам
interface Props {
  movie: movieApi.Film; // Фильм, который заставит вас плакать (от цены билетов)
  onBack: () => void; // Кнопка "спасите, я передумал"
}

interface Session {
  id: string; // Уникальный ID сеанса да я мистер очевидность
  movieId: string; // Какой фильм будем смотреть
  hallId: string; // В каком зале сидеть
  startAt: string; // Когда все начнется
}

interface Seat {
  id: string; // Уникальный ID места
  row: number; // Чем дальше ряд, тем дешевле билет (и хуже видно)
  number: number; // Номер - чтобы не сесть не туда
  categoryId: string; // VIP или "как все"
  status: string; // Свободно, занято или "ой, простите"
}

interface Category {
  id: string; // ID категории
  name: string; // Название (VIP, Стандарт, "У самого экрана")
  priceCents: number; // Цена в копейках, потому что рубли - это скучно
}

interface HallPlan {
  hallId: string; // ID зала
  rows: number;  // Сколько рядов придется пробежать до туалета
  seats: Seat[]; // Все места, хорошие и не очень
  categories: Category[];  // Разные цены за одно и то же сидение
}

// на этом месте у вас должен задергаться глаз, зеленый цвет уже ненавистен 

interface Ticket {
  id: string; // ID билета
  seatId: string; // На какое место
  categoryId: string; // Какая категория
  status: "AVAILABLE" | "RESERVED" | "SOLD"; // Можно купить, уже занято или прощай
  priceCents: number; // Во что влетим
}

interface Purchase {
  id: string; // ID покупки
  ticketIds: string[]; // Какие билеты купили
}

// Главный компонент: здесь решается судьба вашего кошелька
const MovieDetailsPage: React.FC<Props> = ({ movie, onBack }) => {
  const [sessions, setSessions] = useState<Session[]>([]); // Все сеансы
  const [loadingSessions, setLoadingSessions] = useState(true); // Ждем-с...
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] // Сегодня - идеальный день для траты денег
  );
  const [selectedSession, setSelectedSession] = useState<Session | null>(null); // Выбранный сеанс

  const [hallPlan, setHallPlan] = useState<HallPlan | null>(null); // План зала
  const [loadingPlan, setLoadingPlan] = useState(false); // Опять ждем...
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]); // Выбранные места
  const [tickets, setTickets] = useState<Ticket[]>([]); // Все билеты

  const [purchase, setPurchase] = useState<Purchase | null>(null); // Покупка

  // Данные карты - самая секретная часть
  const [cardNumber, setCardNumber] = useState(""); // Цифры, которые все скрывают
  const [expiryDate, setExpiryDate] = useState(""); // Когда карта скажет "пока"
  const [cvv, setCvv] = useState(""); // Три волшебные цифры
  const [cardHolderName, setCardHolderName] = useState(""); // Чье имя на карте

  const token = localStorage.getItem("token"); // Наш пропуск в мир кино


  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true); // Включаем режим ожидания
        const response = await axios.get(`${API_BASE_URL}/sessions`, {
          params: { page: DEFAULT_PAGE, size: PAGE_SIZES.MOVIE_SESSIONS, filmId: movie.id }, // 100 сеансов? Оптимист!
        });
        setSessions(response.data.data || []); // Ура, сеансы пришли!
      } catch (err) {
        console.error("Ошибка загрузки сеансов:", err); // Интернет снова подвел
      } finally {
        setLoadingSessions(false); // Выключаем ожидание
      }
    };
    fetchSessions();
  }, [movie.id]); 

  // Фильтруем сеансы по дате
  const filteredSessions = sessions.filter(
    (s) => s.startAt.slice(0, 10) === selectedDate // Только сегодняшние сеансы
  );

  // Загружаем план зала и билеты
  useEffect(() => {
    if (!selectedSession) return; // Если сеанс не выбран - отдыхаем

    const fetchHallPlanAndTickets = async () => {
      try {
        setLoadingPlan(true); // Опять ждем...
        setSelectedSeats([]);  // Сбрасываем выбор, чтобы начать мучиться заново
        // Два запроса одновременно - потому что мы можем!
        const [planRes, ticketsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/halls/${selectedSession.hallId}/plan`),
          axios.get(`${API_BASE_URL}/sessions/${selectedSession.id}/tickets`),
        ]);

        setHallPlan(planRes.data); // План зала готов!
        setTickets(ticketsRes.data); // Билеты тоже!
      } catch (err) {
        console.error("Ошибка загрузки плана или билетов:", err); // Что-то пошло не так
      } finally {
        setLoadingPlan(false); // Хватит ждать
      }
    };

    fetchHallPlanAndTickets();
  }, [selectedSession]); // Когда меняется сеанс

  // Клик по месту: выбираем или отказываемся
  const handleSeatClick = (seatId: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatId)
        ? prev.filter((id) => id !== seatId) 
        : [...prev, seatId] 
    );
  };

  // здесь моя муза уехала в отпуск простите 
  const getCategory = (catId: string) =>
    hallPlan?.categories.find((c) => c.id === catId); // Ищем нужную категорию

  // Узнаем статус места
  const getSeatStatus = (seatId: string): Ticket["status"] => {
    return tickets.find((t) => t.seatId === seatId)?.status || "AVAILABLE"; // По умолчанию свободно
  };

  // Считаем общую стоимость: момент, когда кошелек плачет
  const totalPrice = selectedSeats.reduce((sum, id) => {
    const seat = hallPlan?.seats.find((s) => s.id === id);
    if (!seat) return sum;
    const cat = getCategory(seat.categoryId);
    return sum + (cat ? cat.priceCents : 0);
  }, 0);

  // Бронирование: когда решаем, что эти места наши
  const handleReserve = async () => {
    if (!token) return alert("Сначала авторизуйтесь"); // Без пропуска не пускаем

    try {
      // Бронируем каждое место по отдельности
      for (const seatId of selectedSeats) {
        const ticket = tickets.find((t) => t.seatId === seatId);
        if (!ticket) continue;

        await axios.post(
          `${API_BASE_URL}/tickets/${ticket.id}/reserve`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      alert("Места успешно забронированы!"); // Ура, получилось!

      // Собираем ID забронированных билетов
      const reservedTickets = tickets
        .filter((t) => selectedSeats.includes(t.seatId))
        .map((t) => t.id);

      // Создаем покупку
      const purchaseRes = await axios.post(
        `${API_BASE_URL}/purchases`,
        { ticketIds: reservedTickets },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPurchase(purchaseRes.data); // Покупка создана!
    } catch (err) {
      console.error("Ошибка при бронировании или покупке:", err);
      alert("Ошибка бронирования. Проверьте авторизацию и доступность мест.");
    }
  };

  // Оплата: момент истины для вашей карты
  const handlePayment = async () => {
    if (!token || !purchase) return alert("Ошибка оплаты"); // Что-то пошло не так

    try {
      await axios.post(
        `${API_BASE_URL}/payments/process`,
        {
          purchaseId: purchase.id,
          cardNumber,
          expiryDate,
          cvv,
          cardHolderName,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Оплата прошла успешно!"); // Деньги улетели!
      // Чистим все поля
      setPurchase(null);
      setSelectedSeats([]);
      setCardNumber("");
      setExpiryDate("");
      setCvv("");
      setCardHolderName("");

      // Обновляем билеты
      const ticketsRes = await axios.get(
        `${API_BASE_URL}/sessions/${selectedSession?.id}/tickets`
      );
      setTickets(ticketsRes.data);
    } catch (err) {
      console.error("Ошибка оплаты:", err);
      alert("Ошибка оплаты. Проверьте данные карты."); 
    }
  };

  // ВНИМАНИЕ МОМЕНТ КОГДА ТЫ ДОЛЖЕН ЗАПЛАКАТЬ 
  return (
    <div className="app-container min-vh-100 d-flex flex-column bg-dark text-light">
      <div className="container py-5">
        {/* Кнопка для возврата на предыдущую страницу */}
        <button className="btn btn-outline-light mb-4" onClick={onBack}>
          ← Назад {/* Стрелка назад и текст */}
        </button>

        {/* Основной контент в виде сетки строки */}
        <div className="row g-4 align-items-start">
          {/* Колонка для изображения фильма */}
          <div className="col-md-4 text-center">
            <img
              src={movie.imageUrl || "https://placehold.co/300x450"} // URL изображения или заглушка
              className="img-fluid rounded shadow mb-3" // Стили для изображения
              alt={movie.title} // Альтернативный текст для доступности
            />
          </div>

          {/* Колонка для информации о фильме и функционала бронирования */}
          <div className="col-md-8">
            {/* Заголовок с названием фильма */}
            <h2 className="text-primary mb-3">{movie.title}</h2>
            {/* Описание фильма */}
            <p>{movie.description}</p>
            {/* Информация о жанре фильма */}
            <p>
              <strong>Жанр:</strong> {movie.genre}
            </p>
            {/* Информация о возрастном рейтинге */}
            <p>
              <strong>Возраст:</strong> {movie.ageRating}
            </p>

            {/* Блок выбора даты для просмотра сеансов */}
            <div className="mb-3">
              <label className="text-light me-2">Выберите дату:</label>
              <input
                type="date" // Тип input - выбор даты
                className="form-control d-inline-block" // Стили Bootstrap
                style={{ width: "200px" }} // Инлайн стиль для ширины
                value={selectedDate} // Привязка значения к состоянию
                onChange={(e) => {
                  // Обработчик изменения даты
                  setSelectedDate(e.target.value); // Обновляем выбранную дату
                  setSelectedSession(null); // Сбрасываем выбранный сеанс
                  setHallPlan(null); // Сбрасываем план зала
                }}
              />
            </div>

            {/* Заголовок для секции доступных сеансов */}
            <h5 className="mt-4 text-light">Доступные сеансы:</h5>
            {/* Контейнер для кнопок сеансов */}
            <div className="d-flex flex-wrap gap-2 mt-2">
              {/* Показываем сообщение о загрузке если сеансы еще грузятся */}
              {loadingSessions && <p>Загрузка сеансов...</p>}
              {/* Показываем сообщение если сеансов нет для выбранной даты */}
              {!loadingSessions && filteredSessions.length === 0 && (
                <p>Сеансов нет</p>
              )}
              {/* Рендерим кнопки для каждого доступного сеанса */}
              {!loadingSessions &&
                filteredSessions.map((session) => {
                  // Форматируем время начала сеанса в читаемый формат
                  const time = new Date(session.startAt).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" } // Формат ЧЧ:ММ
                  );
                  return (
                    <button
                      key={session.id} // Уникальный ключ для React
                      className={`btn btn-primary btn-lg ${
                        // Добавляем класс active если этот сеанс выбран
                        selectedSession?.id === session.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedSession(session)} // Обработчик клика
                    >
                      {time} — Зал {/* Время сеанса и текст "Зал" */}
                    </button>
                  );
                })}
            </div>

            {/* Блок который показывается только если выбран сеанс */}
            {selectedSession && (
              <div className="mt-4">
                {/* Заголовок для схемы зала */}
                <h5 className="text-light mb-3">Схема зала:</h5>
                {/* Показываем сообщение о загрузке если план зала грузится */}
                {loadingPlan && <p>Загрузка плана зала...</p>}
                {/* Рендерим схему зала если данные загружены */}
                {hallPlan && (
                  <div
                    className="d-flex flex-column align-items-center mb-4"
                    style={{ gap: "10px" }} // Отступ между элементами
                  >
                    {/* Легенда с категориями мест и их цветами */}
                    <div className="d-flex flex-wrap justify-content-center gap-4 mb-3">
                      {/* Для каждой категории создаем элемент легенды */}
                      {hallPlan.categories.map((c) => (
                        <div
                          key={c.id} // Уникальный ключ
                          className="d-flex align-items-center gap-1" // Стили для выравнивания
                        >
                          {/* Цветной квадратик представляющий категорию */}
                          <span
                            className="btn" // Класс кнопки для стилей
                            style={{
                              width: "20px", // Фиксированная ширина
                              height: "20px", // Фиксированная высота
                              padding: 0, // Убираем отступы
                              // Разный цвет для VIP и обычных категорий
                              backgroundColor:
                                c.name.toLowerCase().includes("vip")
                                  ? "#0d6efd" // Синий для VIP
                                  : "#fff", // Белый для стандартных
                              // Разная рамка в зависимости от категории
                              border:
                                c.name.toLowerCase().includes("vip")
                                  ? "1px solid #0d6efd" // Синяя рамка для VIP
                                  : "1px solid #fff", // Белая рамка для стандартных
                            }}
                          ></span>
                          {/* Текст с названием категории и ценой */}
                          <small className="text-light">
                            {c.name} — {c.priceCents } ₽
                          </small>
                        </div>
                      ))}

                      {/* Элемент легенды для свободных мест */}
                      <div className="d-flex align-items-center gap-1">
                        <span
                          className="btn btn-outline-light" // Стиль контурной кнопки
                          style={{ width: "20px", height: "20px", padding: 0 }} // Размеры
                        ></span>
                        <small>Свободно</small> {/* Текст пояснения */}
                      </div>
                      {/* Элемент легенды для забронированных мест */}
                      <div className="d-flex align-items-center gap-1">
                        <span
                          className="btn btn-warning" // Стиль предупреждения
                          style={{ width: "20px", height: "20px", padding: 0 }} // Размеры
                        ></span>
                        <small>Забронировано</small> {/* Текст пояснения */}
                      </div>
                      {/* Элемент легенды для проданных мест */}
                      <div className="d-flex align-items-center gap-1">
                        <span
                          className="btn btn-danger" // Стиль опасности
                          style={{ width: "20px", height: "20px", padding: 0 }} // Размеры
                        ></span>
                        <small>Продано</small> {/* Текст пояснения */}
                      </div>
                    </div>

                    {/* Рендерим ряды мест в зале */}
                    {Array.from(new Set(hallPlan.seats.map((s) => s.row))) // Получаем уникальные номера рядов
                      .sort((a, b) => a - b) // Сортируем ряды по возрастанию
                      .map((rowNum) => {
                        // Для каждого ряда получаем все места в этом ряду
                        const rowSeats = hallPlan.seats
                          .filter((s) => s.row === rowNum) // Фильтруем места по номеру ряда
                          .sort((a, b) => a.number - b.number); // Сортируем места по номеру

                        return (
                          // Контейнер для ряда мест
                          <div
                            key={rowNum} // Уникальный ключ по номеру ряда
                            style={{
                              display: "grid", // Используем CSS Grid для расположения
                              // Динамическое количество колонок по количеству мест в ряду
                              gridTemplateColumns: `repeat(${rowSeats.length}, 50px)`,
                              gap: "5px", // Отступ между местами
                            }}
                          >
                            {/* Рендерим каждое место в ряду */}
                            {rowSeats.map((seat) => {
                              // Получаем статус текущего места
                              const status = getSeatStatus(seat.id);
                              // Получаем категорию места
                              const category = getCategory(seat.categoryId);
                              // Проверяем выбрано ли это место пользователем
                              const isSelected = selectedSeats.includes(seat.id);

                              // Определяем цвет кнопки в зависимости от статуса
                              let color = "btn-outline-light"; // По умолчанию - свободно
                              if (status === "SOLD") color = "btn-danger"; // Красный для проданных
                              else if (status === "RESERVED") color = "btn-warning"; // Желтый для забронированных
                              else if (isSelected) color = "btn-success"; // Зеленый для выбранных

                              return (
                                <button
                                  key={seat.id} // Уникальный ключ по ID места
                                  className={`btn ${color}`} // Классы кнопки с определенным цветом
                                  style={{ width: "50px", height: "50px" }} // Фиксированный размер
                                  disabled={status !== "AVAILABLE"} // Отключаем если место не доступно
                                  onClick={() => handleSeatClick(seat.id)} // Обработчик клика
                                  // Всплывающая подсказка с информацией о месте
                                  title={`${category?.name || "Место"} — ${
                                    category ? category.priceCents : 0
                                  } ₽`}
                                >
                                  {seat.number} {/* Номер места на кнопке */}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Блок для выбранных мест и кнопки бронирования */}
                {selectedSeats.length > 0 && hallPlan && !purchase && (
              <div className="text-center mb-3">
                  {/* Список выбранных мест с подробной информацией */}
                  <p>
                  <strong>Выбраны места:</strong>{" "}
                  {selectedSeats
                    .map((id) => {
                      // Для каждого выбранного места находим соответствующий билет
                      const ticket = tickets.find((t) => t.seatId === id);
                      // Если билет не найден или нет плана зала, возвращаем пустую строку
                      if (!ticket || !hallPlan) return ""; 

                      // Находим объект места по ID
                      const seat = hallPlan.seats.find((s) => s.id === id);
                      // Если место не найдено, возвращаем пустую строку
                      if (!seat) return "";

                      // Получаем категорию билета
                      const cat = getCategory(ticket.categoryId);
                      // Форматируем информацию о месте: ряд, номер, категория, цена
                      return `Ряд ${seat.row + 1}, №${seat.number} (${cat?.name} — ${
                        cat ? cat.priceCents : 0
                      } ₽)`;
                    })
                    .filter(Boolean) // Убираем пустые строки
                    .join("; ")} {/* Объединяем все строки через точку с запятой */}
                </p>

                {/* Общая стоимость выбранных мест */}
                <p>
                  <strong>Итого:</strong> {totalPrice} ₽
                </p>
                {/* Кнопка для бронирования выбранных мест */}
                <button className="btn btn-primary px-5" onClick={handleReserve}>
                  Забронировать
                </button>
              </div>
            )}

                {/* Блок оплаты который показывается после успешного бронирования */}
                  {purchase && hallPlan && (
                    <div className="text-center mt-4 p-3 border border-light rounded">
                      <h5>Оплата</h5>
                      {/* Информация о забронированных местах */}
                      <p>
                        <strong>Места:</strong>{" "}
                        {tickets
                          .filter((t) => purchase.ticketIds.includes(t.id)) // Фильтруем билеты входящие в покупку
                          .map((t) => {
                            // Для каждого билета получаем категорию и место
                            const cat = getCategory(t.categoryId);
                            const seat = hallPlan.seats.find((s) => s.id === t.seatId);
                            // Форматируем информацию о месте
                            return seat
                              ? `Ряд ${seat.row + 1}, №${seat.number} (${cat?.name} — ${
                                  cat?.priceCents
                                } ₽)`
                              : ""; // Пустая строка если место не найдено
                          })
                          .join("; ")} {/* Объединяем через точку с запятой */}
                      </p>
                      {/* Общая сумма к оплате */}
                                        <p>
                      <strong>Сумма:</strong>{" "}
                      {tickets
                        .filter((t) => purchase.ticketIds.includes(t.id)) // Фильтруем билеты покупки
                        .reduce((sum, t) => {
                          // Суммируем цены всех билетов
                          const cat = getCategory(t.categoryId);
                          return sum + (cat ? cat.priceCents : 0); // Добавляем цену категории
                        }, 0)}{" "}
                      ₽
                    </p>

                      {/* Форма для ввода данных банковской карты */}
                      <div className="d-flex flex-column align-items-center gap-2">
                        {/* Поле для номера карты */}
                        <input
                          placeholder="Номер карты"
                          className="form-control"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                        />
                        {/* Поле для срока действия карты */}
                        <input
                          placeholder="Срок (MM/YY)"
                          className="form-control"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                        />
                        {/* Поле для CVV кода */}
                        <input
                          placeholder="CVV"
                          className="form-control"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                        />
                        {/* Поле для имени владельца карты */}
                        <input
                          placeholder="Имя владельца карты"
                          className="form-control"
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value)}
                        />
                        {/* Кнопка для выполнения оплаты */}
                        <button
                          className="btn btn-success px-5 mt-2"
                          onClick={handlePayment}
                        >
                          Оплатить
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            )}
               
          </div>
           {/* Компонент для отображения отзывов о фильме */}
           <ReviewsDisplay movieId={movie.id} />
        </div>
      </div>
    </div>
  );
}

// Экспорт компонента по умолчанию
export default MovieDetailsPage;
