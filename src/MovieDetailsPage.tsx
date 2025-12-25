import React, { useEffect, useState } from "react";
import axios from "axios";
import * as movieApi from "./api/movie";
import { API_BASE_URL, DEFAULT_PAGE, PAGE_SIZES } from "./api/constants";
import ReviewsDisplay from "./ReviewsDisplay";


interface Props {
  movie: movieApi.Film; 
  onBack: () => void; 
}

interface Session {
  id: string; 
  movieId: string; 
  hallId: string; 
  startAt: string; 
}

interface Seat {
  id: string; 
  row: number; 
  number: number; 
  categoryId: string; 
  status: string; 
}

interface Category {
  id: string; 
  name: string; 
  priceCents: number; 
}

interface HallPlan {
  hallId: string; 
  rows: number;  
  seats: Seat[]; 
  categories: Category[];  
}



interface Ticket {
  id: string; 
  seatId: string; 
  categoryId: string; 
  status: "AVAILABLE" | "RESERVED" | "SOLD"; 
  priceCents: number; 
}

interface Purchase {
  id: string; 
  ticketIds: string[]; 
}


const MovieDetailsPage: React.FC<Props> = ({ movie, onBack }) => {
  const [sessions, setSessions] = useState<Session[]>([]); 
  const [loadingSessions, setLoadingSessions] = useState(true); 
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] 
  );
  const [selectedSession, setSelectedSession] = useState<Session | null>(null); 

  const [hallPlan, setHallPlan] = useState<HallPlan | null>(null); 
  const [loadingPlan, setLoadingPlan] = useState(false); 
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]); 
  const [tickets, setTickets] = useState<Ticket[]>([]); 

  const [purchase, setPurchase] = useState<Purchase | null>(null); 

  
  const [cardNumber, setCardNumber] = useState(""); 
  const [expiryDate, setExpiryDate] = useState(""); 
  const [cvv, setCvv] = useState(""); 
  const [cardHolderName, setCardHolderName] = useState(""); 

  const token = localStorage.getItem("token"); 


  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingSessions(true); 
        const response = await axios.get(`${API_BASE_URL}/sessions`, {
          params: { page: DEFAULT_PAGE, size: PAGE_SIZES.MOVIE_SESSIONS, filmId: movie.id }, 
        });
        setSessions(response.data.data || []); 
      } catch (err) {
        console.error("Ошибка загрузки сеансов:", err); 
      } finally {
        setLoadingSessions(false); 
      }
    };
    fetchSessions();
  }, [movie.id]); 

  
  const filteredSessions = sessions.filter(
    (s) => s.startAt.slice(0, 10) === selectedDate 
  );

  
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

        setHallPlan(planRes.data); 
        setTickets(ticketsRes.data); 
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

  
  const getCategory = (catId: string) =>
    hallPlan?.categories.find((c) => c.id === catId); 

  
  const getSeatStatus = (seatId: string): Ticket["status"] => {
    return tickets.find((t) => t.seatId === seatId)?.status || "AVAILABLE"; 
  };

  
  const totalPrice = selectedSeats.reduce((sum, id) => {
    const seat = hallPlan?.seats.find((s) => s.id === id);
    if (!seat) return sum;
    const cat = getCategory(seat.categoryId);
    return sum + (cat ? cat.priceCents : 0);
  }, 0);

  
  const handleReserve = async () => {
    if (!token) return alert("Сначала авторизуйтесь"); 

    try {
      
      for (const seatId of selectedSeats) {
        const ticket = tickets.find((t) => t.seatId === seatId);
        if (!ticket) continue;

        await axios.post(
          `${API_BASE_URL}/tickets/${ticket.id}/reserve`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      alert("Места успешно забронированы!"); 

      
      const reservedTickets = tickets
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
          cardNumber,
          expiryDate,
          cvv,
          cardHolderName,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Оплата прошла успешно!"); 
      
      setPurchase(null);
      setSelectedSeats([]);
      setCardNumber("");
      setExpiryDate("");
      setCvv("");
      setCardHolderName("");

      
      const ticketsRes = await axios.get(
        `${API_BASE_URL}/sessions/${selectedSession?.id}/tickets`
      );
      setTickets(ticketsRes.data);
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
                value={selectedDate} 
                onChange={(e) => {
                  
                  setSelectedDate(e.target.value); 
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
                  
                  const time = new Date(session.startAt).toLocaleTimeString(
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
                            {c.name} — {c.priceCents } ₽
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
                              
                              const category = getCategory(seat.categoryId);
                              
                              const isSelected = selectedSeats.includes(seat.id);

                              
                              let color = "btn-outline-light"; 
                              if (status === "SOLD") color = "btn-danger"; 
                              else if (status === "RESERVED") color = "btn-warning"; 
                              else if (isSelected) color = "btn-success"; 

                              return (
                                <button
                                  key={seat.id} 
                                  className={`btn ${color}`} 
                                  style={{ width: "50px", height: "50px" }} 
                                  disabled={status !== "AVAILABLE"} 
                                  onClick={() => handleSeatClick(seat.id)} 
                                  
                                  title={`${category?.name || "Место"} — ${
                                    category ? category.priceCents : 0
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
                      
                      const ticket = tickets.find((t) => t.seatId === id);
                      
                      if (!ticket || !hallPlan) return ""; 

                      
                      const seat = hallPlan.seats.find((s) => s.id === id);
                      
                      if (!seat) return "";

                      
                      const cat = getCategory(ticket.categoryId);
                      
                      return `Ряд ${seat.row + 1}, №${seat.number} (${cat?.name} — ${
                        cat ? cat.priceCents : 0
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
                        {tickets
                          .filter((t) => purchase.ticketIds.includes(t.id)) 
                          .map((t) => {
                            
                            const cat = getCategory(t.categoryId);
                            const seat = hallPlan.seats.find((s) => s.id === t.seatId);
                            
                            return seat
                              ? `Ряд ${seat.row + 1}, №${seat.number} (${cat?.name} — ${
                                  cat?.priceCents
                                } ₽)`
                              : ""; 
                          })
                          .join("; ")} 
                      </p>
                      
                                        <p>
                      <strong>Сумма:</strong>{" "}
                      {tickets
                        .filter((t) => purchase.ticketIds.includes(t.id)) 
                        .reduce((sum, t) => {
                          
                          const cat = getCategory(t.categoryId);
                          return sum + (cat ? cat.priceCents : 0); 
                        }, 0)}{" "}
                      ₽
                    </p>

                      
                      <div className="d-flex flex-column align-items-center gap-2">
                        
                        <input
                          placeholder="Номер карты"
                          className="form-control"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                        />
                        
                        <input
                          placeholder="Срок (MM/YY)"
                          className="form-control"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                        />
                        
                        <input
                          placeholder="CVV"
                          className="form-control"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                        />
                        
                        <input
                          placeholder="Имя владельца карты"
                          className="form-control"
                          value={cardHolderName}
                          onChange={(e) => setCardHolderName(e.target.value)}
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
