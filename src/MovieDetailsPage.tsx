import React, { useEffect, useState } from "react";
import axios from "axios";
import * as movieApi from "./api/movie";
import { API_BASE_URL, DEFAULT_PAGE, PAGE_SIZES } from "./api/constants";
import ReviewsDisplay from "./ReviewsDisplay";
import { TicketStatus } from "./types/domain";
import type { CardDetails } from "./types/domain";

interface Props {
  movie: movieApi.Film; 
  onBack: () => void; 
}

interface Session {
  id: string; 
  movieId: string; 
  hallId: string; 
  startAt: Date; 
}

interface Seat {
  id: string; 
  row: number; 
  number: number; 
  categoryId: string; 
  status: string; 
}

interface SeatCategory {
  id: string; 
  name: string; 
  priceRub: number; 
}

interface HallPlan {
  hallId: string; 
  rows: number;  
  seats: Seat[]; 
  categories: SeatCategory[];  
}



interface SessionSeatTicket {
  id: string; 
  seatId: string; 
  categoryId: string; 
  status: TicketStatus; 
  priceRub: number; 
}

interface Purchase {
  id: string; 
  ticketIds: string[]; 
}


const MovieDetailsPage: React.FC<Props> = ({ movie, onBack }) => {
  const [sessions, setSessions] = useState<Session[]>([]); 
  const [loadingSessions, setLoadingSessions] = useState(true); 
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSession, setSelectedSession] = useState<Session | null>(null); 

  const [hallPlan, setHallPlan] = useState<HallPlan | null>(null); 
  const [loadingPlan, setLoadingPlan] = useState(false); 
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]); 
  const [sessionSeatTickets, setSessionSeatTickets] = useState<SessionSeatTicket[]>([]); 

  const [purchase, setPurchase] = useState<Purchase | null>(null); 

  
  const [card, setCard] = useState<CardDetails>({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardHolderName: "",
  }); 

  const token = localStorage.getItem("token"); 

  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseDateInputValue = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const updateCardField = (field: keyof CardDetails, value: string) => {
    setCard((prev) => ({ ...prev, [field]: value }));
  };


  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true); 
        const response = await axios.get(`${API_BASE_URL}/sessions`, {
          params: { page: DEFAULT_PAGE, size: PAGE_SIZES.MOVIE_SESSIONS, filmId: movie.id }, 
        });
        const data = response.data.data || [];
        const mapped = data.map((session: { startAt: string } & Omit<Session, "startAt">) => ({
          ...session,
          startAt: new Date(session.startAt),
        }));
        setSessions(mapped); 
      } catch (err) {
        console.error("Ошибка загрузки сеансов:", err); 
      } finally {
        setLoadingSessions(false); 
      }
    };
    fetchSessions();
  }, [movie.id]); 

  
  const filteredSessions = sessions.filter((s) => isSameDay(s.startAt, selectedDate));

  
  useEffect(() => {
    if (!selectedSession) return; 

    const fetchHallPlanAndTickets = async () => {
      try {
        setLoadingPlan(true); 
        setSelectedSeats([]);  
        
        const [planRes, ticketsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/halls/${selectedSession.hallId}/plan`),
          axios.get(`${API_BASE_URL}/sessions/${selectedSession.id}/tickets`),
        ]);

        setHallPlan({
          ...planRes.data,
          categories: planRes.data.categories.map(
            (category: { priceCents: number } & Omit<SeatCategory, "priceRub">) => ({
              ...category,
              priceRub: category.priceCents,
            })
          ),
        });
        setSessionSeatTickets(
          ticketsRes.data.map(
            (ticket: { priceCents: number } & Omit<SessionSeatTicket, "priceRub">) => ({
              ...ticket,
              priceRub: ticket.priceCents,
            })
          )
        );
      } catch (err) {
        console.error("Ошибка загрузки плана или билетов:", err); 
      } finally {
        setLoadingPlan(false); 
      }
    };

    fetchHallPlanAndTickets();
  }, [selectedSession]); 

  
  const handleSeatClick = (seatId: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatId)
        ? prev.filter((id) => id !== seatId) 
        : [...prev, seatId] 
    );
  };

  
  const getSeatCategory = (catId: string) =>
    hallPlan?.categories.find((c) => c.id === catId); 

  
  const getSeatStatus = (seatId: string): SessionSeatTicket["status"] => {
    return (
      sessionSeatTickets.find((t) => t.seatId === seatId)?.status ||
      TicketStatus.Available
    ); 
  };

  
  const totalPrice = selectedSeats.reduce((sum, id) => {
    const seat = hallPlan?.seats.find((s) => s.id === id);
    if (!seat) return sum;
    const cat = getSeatCategory(seat.categoryId);
    return sum + (cat ? cat.priceRub : 0);
  }, 0);

  
  const handleReserve = async () => {
    if (!token) return alert("Сначала авторизуйтесь"); 

    try {
      
      for (const seatId of selectedSeats) {
        const sessionSeatTicket = sessionSeatTickets.find((t) => t.seatId === seatId);
        if (!sessionSeatTicket) continue;

        await axios.post(
          `${API_BASE_URL}/tickets/${sessionSeatTicket.id}/reserve`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      alert("Места успешно забронированы!"); 

      
      const reservedTickets = sessionSeatTickets
        .filter((t) => selectedSeats.includes(t.seatId))
        .map((t) => t.id);

      
      const purchaseRes = await axios.post(
        `${API_BASE_URL}/purchases`,
        { ticketIds: reservedTickets },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPurchase(purchaseRes.data); 
    } catch (err) {
      console.error("Ошибка при бронировании или покупке:", err);
      alert("Ошибка бронирования. Проверьте авторизацию и доступность мест.");
    }
  };

  
  const handlePayment = async () => {
    if (!token || !purchase) return alert("Ошибка оплаты"); 

    try {
      await axios.post(
        `${API_BASE_URL}/payments/process`,
        {
          purchaseId: purchase.id,
          ...card,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Оплата прошла успешно!"); 
      
      setPurchase(null);
      setSelectedSeats([]);
      setCard({
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardHolderName: "",
      });

      
      const ticketsRes = await axios.get(
        `${API_BASE_URL}/sessions/${selectedSession?.id}/tickets`
      );
      setSessionSeatTickets(
        ticketsRes.data.map(
          (ticket: { priceCents: number } & Omit<SessionSeatTicket, "priceRub">) => ({
            ...ticket,
            priceRub: ticket.priceCents,
          })
        )
      );
    } catch (err) {
      console.error("Ошибка оплаты:", err);
      alert("Ошибка оплаты. Проверьте данные карты."); 
    }
  };

  
  return (
    <div className="app-container min-vh-100 d-flex flex-column bg-dark text-light">
      <div className="container py-5">
        
        <button className="btn btn-outline-light mb-4" onClick={onBack}>
          ← Назад 
        </button>

        
        <div className="row g-4 align-items-start">
          
          <div className="col-md-4 text-center">
            <img
              src={movie.imageUrl || "https://placehold.co/300x450"} 
              className="img-fluid rounded shadow mb-3" 
              alt={movie.title} 
            />
          </div>

          
          <div className="col-md-8">
            
            <h2 className="text-primary mb-3">{movie.title}</h2>
            
            <p>{movie.description}</p>
            
            <p>
              <strong>Жанр:</strong> {movie.genre}
            </p>
            
            <p>
              <strong>Возраст:</strong> {movie.ageRating}
            </p>

            
            <div className="mb-3">
              <label className="text-light me-2">Выберите дату:</label>
              <input
                type="date" 
                className="form-control d-inline-block" 
                style={{ width: "200px" }} 
                value={toDateInputValue(selectedDate)} 
                onChange={(e) => {
                  
                  setSelectedDate(parseDateInputValue(e.target.value)); 
                  setSelectedSession(null); 
                  setHallPlan(null); 
                }}
              />
            </div>

            
            <h5 className="mt-4 text-light">Доступные сеансы:</h5>
            
            <div className="d-flex flex-wrap gap-2 mt-2">
              
              {loadingSessions && <p>Загрузка сеансов...</p>}
              
              {!loadingSessions && filteredSessions.length === 0 && (
                <p>Сеансов нет</p>
              )}
              
              {!loadingSessions &&
                filteredSessions.map((session) => {
                  
                  const time = session.startAt.toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" } 
                  );
                  return (
                    <button
                      key={session.id} 
                      className={`btn btn-primary btn-lg ${
                        selectedSession?.id === session.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedSession(session)} 
                    >
                      {time} — Зал 
                    </button>
                  );
                })}
            </div>

            
            {selectedSession && (
              <div className="mt-4">
                
                <h5 className="text-light mb-3">Схема зала:</h5>
                
                {loadingPlan && <p>Загрузка плана зала...</p>}
                
                {hallPlan && (
                  <div
                    className="d-flex flex-column align-items-center mb-4"
                    style={{ gap: "10px" }} 
                  >
                    
                    <div className="d-flex flex-wrap justify-content-center gap-4 mb-3">
                      
                      {hallPlan.categories.map((c) => (
                        <div
                          key={c.id} 
                          className="d-flex align-items-center gap-1" 
                        >
                          
                          <span
                            className="btn" 
                            style={{
                              width: "20px", 
                              height: "20px", 
                              padding: 0, 
                              
                              backgroundColor:
                                c.name.toLowerCase().includes("vip")
                                  ? "#0d6efd" 
                                  : "#fff", 
                              
                              border:
                                c.name.toLowerCase().includes("vip")
                                  ? "1px solid #0d6efd" 
                                  : "1px solid #fff", 
                            }}
                          ></span>
                          
                          <small className="text-light">
                            {c.name} — {c.priceRub } ₽
                          </small>
                        </div>
                      ))}

                      
                      <div className="d-flex align-items-center gap-1">
                        <span
                          className="btn btn-outline-light" 
                          style={{ width: "20px", height: "20px", padding: 0 }} 
                        ></span>
                        <small>Свободно</small> 
                      </div>
                      
                      <div className="d-flex align-items-center gap-1">
                        <span
                          className="btn btn-warning" 
                          style={{ width: "20px", height: "20px", padding: 0 }} 
                        ></span>
                        <small>Забронировано</small> 
                      </div>
                      
                      <div className="d-flex align-items-center gap-1">
                        <span
                          className="btn btn-danger" 
                          style={{ width: "20px", height: "20px", padding: 0 }} 
                        ></span>
                        <small>Продано</small> 
                      </div>
                    </div>

                    
                    {Array.from(new Set(hallPlan.seats.map((s) => s.row))) 
                      .sort((a, b) => a - b) 
                      .map((rowNum) => {
                        
                        const rowSeats = hallPlan.seats
                          .filter((s) => s.row === rowNum) 
                          .sort((a, b) => a.number - b.number); 

                        return (
                          
                          <div
                            key={rowNum} 
                            style={{
                              display: "grid", 
                              
                              gridTemplateColumns: `repeat(${rowSeats.length}, 50px)`,
                              gap: "5px", 
                            }}
                          >
                            
                            {rowSeats.map((seat) => {
                              
                              const status = getSeatStatus(seat.id);
                              
                              const category = getSeatCategory(seat.categoryId);
                              
                              const isSelected = selectedSeats.includes(seat.id);

                              
                              let color = "btn-outline-light"; 
                              if (status === TicketStatus.Sold) color = "btn-danger"; 
                              else if (status === TicketStatus.Reserved) color = "btn-warning"; 
                              else if (isSelected) color = "btn-success"; 

                              return (
                                <button
                                  key={seat.id} 
                                  className={`btn ${color}`} 
                                  style={{ width: "50px", height: "50px" }} 
                                  disabled={status !== TicketStatus.Available} 
                                  onClick={() => handleSeatClick(seat.id)} 
                                  
                                  title={`${category?.name || "Место"} — ${
                                    category ? category.priceRub : 0
                                  } ₽`}
                                >
                                  {seat.number} 
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                )}

                
                {selectedSeats.length > 0 && hallPlan && !purchase && (
              <div className="text-center mb-3">
                  
                  <p>
                  <strong>Выбраны места:</strong>{" "}
                  {selectedSeats
                    .map((id) => {
                      
                      const sessionSeatTicket = sessionSeatTickets.find(
                        (t) => t.seatId === id
                      );
                      
                      if (!sessionSeatTicket || !hallPlan) return ""; 

                      
                      const seat = hallPlan.seats.find((s) => s.id === id);
                      
                      if (!seat) return "";

                      
                      const cat = getSeatCategory(sessionSeatTicket.categoryId);
                      
                      return `Ряд ${seat.row + 1}, №${seat.number} (${cat?.name} — ${
                        cat ? cat.priceRub : 0
                      } ₽)`;
                    })
                    .filter(Boolean) 
                    .join("; ")} 
                </p>

                
                <p>
                  <strong>Итого:</strong> {totalPrice} ₽
                </p>
                
                <button className="btn btn-primary px-5" onClick={handleReserve}>
                  Забронировать
                </button>
              </div>
            )}

                
                  {purchase && hallPlan && (
                    <div className="text-center mt-4 p-3 border border-light rounded">
                      <h5>Оплата</h5>
                      
                      <p>
                        <strong>Места:</strong>{" "}
                        {sessionSeatTickets
                          .filter((t) => purchase.ticketIds.includes(t.id)) 
                          .map((t) => {
                            
                            const cat = getSeatCategory(t.categoryId);
                            const seat = hallPlan.seats.find((s) => s.id === t.seatId);
                            
                            return seat
                              ? `Ряд ${seat.row + 1}, №${seat.number} (${cat?.name} — ${
                                  cat?.priceRub
                                } ₽)`
                              : ""; 
                          })
                          .join("; ")} 
                      </p>
                      
                                        <p>
                      <strong>Сумма:</strong>{" "}
                      {sessionSeatTickets
                        .filter((t) => purchase.ticketIds.includes(t.id)) 
                        .reduce((sum, t) => {
                          
                          const cat = getSeatCategory(t.categoryId);
                          return sum + (cat ? cat.priceRub : 0); 
                        }, 0)}{" "}
                      ₽
                    </p>

                      
                      <div className="d-flex flex-column align-items-center gap-2">
                        
                        <input
                          placeholder="Номер карты"
                          className="form-control"
                          value={card.cardNumber}
                          onChange={(e) => updateCardField("cardNumber", e.target.value)}
                        />
                        
                        <input
                          placeholder="Срок (MM/YY)"
                          className="form-control"
                          value={card.expiryDate}
                          onChange={(e) => updateCardField("expiryDate", e.target.value)}
                        />
                        
                        <input
                          placeholder="CVV"
                          className="form-control"
                          value={card.cvv}
                          onChange={(e) => updateCardField("cvv", e.target.value)}
                        />
                        
                        <input
                          placeholder="Имя владельца карты"
                          className="form-control"
                          value={card.cardHolderName}
                          onChange={(e) => updateCardField("cardHolderName", e.target.value)}
                        />
                        
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
           
           <ReviewsDisplay movieId={movie.id} />
        </div>
      </div>
    </div>
  );
}


export default MovieDetailsPage;
