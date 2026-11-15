from datetime import date, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import DB, StaffUser
from app.models import Booking, BookingStatus, Hotel, RoomType
from app.schemas import Stats

router = APIRouter(prefix="/api/stats", tags=["dashboard"])


@router.get("", response_model=Stats)
def stats(db: DB, _: StaffUser) -> Stats:
    today = date.today()
    confirmed = Booking.status == BookingStatus.CONFIRMED

    rooms = db.scalar(select(func.coalesce(func.sum(RoomType.total_rooms), 0))) or 0
    occupied = db.scalar(
        select(func.count(Booking.id)).where(confirmed, Booking.check_in <= today, Booking.check_out > today)
    ) or 0
    return Stats(
        hotels=db.scalar(select(func.count(Hotel.id))) or 0,
        rooms=rooms,
        arrivals_today=db.scalar(select(func.count(Booking.id)).where(confirmed, Booking.check_in == today)) or 0,
        occupied_tonight=occupied,
        occupancy_tonight=round(occupied / rooms, 4) if rooms else 0.0,
        upcoming_bookings=db.scalar(select(func.count(Booking.id)).where(confirmed, Booking.check_in >= today)) or 0,
        revenue_next_30_days=float(
            db.scalar(
                select(func.coalesce(func.sum(Booking.total_price), 0)).where(
                    confirmed, Booking.check_in >= today, Booking.check_in < today + timedelta(days=30)
                )
            )
            or 0
        ),
    )
