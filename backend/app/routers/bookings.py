from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.deps import DB, StaffUser
from app.models import Booking, BookingStatus, RatePlan, RoomType
from app.schemas import BookingIn, BookingOut
from app.services import booked_rooms

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def _out(b: Booking) -> BookingOut:
    """Flatten a booking and its related rows into one easy-to-display record."""
    return BookingOut(
        id=b.id,
        room_type_id=b.room_type_id,
        rate_plan_id=b.rate_plan_id,
        hotel_id=b.room_type.hotel_id,
        hotel_name=b.room_type.hotel.name,
        room_type_name=b.room_type.name,
        rate_plan_name=b.rate_plan.name,
        guest_name=b.guest_name,
        guest_email=b.guest_email,
        check_in=b.check_in,
        check_out=b.check_out,
        nights=b.nights,
        guests=b.guests,
        status=b.status,
        total_price=b.total_price,
        created_by=b.created_by.full_name if b.created_by else None,
        created_at=b.created_at,
    )


def _with_relations():
    return (
        joinedload(Booking.room_type).joinedload(RoomType.hotel),
        joinedload(Booking.rate_plan),
        joinedload(Booking.created_by),
    )


def _get(db: DB, booking_id: int) -> Booking:
    booking = db.scalar(select(Booking).where(Booking.id == booking_id).options(*_with_relations()))
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
    return booking


@router.get("", response_model=list[BookingOut])
def list_bookings(
    db: DB,
    _: StaffUser,
    hotel_id: int | None = None,
    status_: BookingStatus | None = Query(None, alias="status"),
    from_date: date | None = Query(None, alias="from", description="Stays that end after this date"),
    to_date: date | None = Query(None, alias="to", description="Stays that start before this date"),
) -> list[BookingOut]:
    query = select(Booking).join(Booking.room_type).options(*_with_relations())
    if hotel_id is not None:
        query = query.where(RoomType.hotel_id == hotel_id)
    if status_ is not None:
        query = query.where(Booking.status == status_)
    if from_date is not None:
        query = query.where(Booking.check_out > from_date)
    if to_date is not None:
        query = query.where(Booking.check_in < to_date)
    bookings = db.scalars(query.order_by(Booking.check_in.desc(), Booking.id.desc())).unique().all()
    return [_out(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: DB, _: StaffUser) -> BookingOut:
    return _out(_get(db, booking_id))


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(body: BookingIn, db: DB, user: StaffUser) -> BookingOut:
    # Lock this room type's row until we commit. If two people book the last room at the same
    # moment, the second waits here, then sees the first booking and gets "sold out" instead of
    # both succeeding (overbooking). (PostgreSQL: SELECT ... FOR UPDATE.)
    room_type = db.scalar(select(RoomType).where(RoomType.id == body.room_type_id).with_for_update())
    if room_type is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Room type not found")
    rate_plan = db.get(RatePlan, body.rate_plan_id)
    if rate_plan is None or rate_plan.room_type_id != room_type.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That rate plan doesn't belong to this room type")
    if body.guests > room_type.capacity:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"{room_type.name} fits at most {room_type.capacity} guests",
        )
    if booked_rooms(db, room_type.id, body.check_in, body.check_out) >= room_type.total_rooms:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{room_type.name} is sold out for those dates")

    nights = (body.check_out - body.check_in).days
    booking = Booking(
        **body.model_dump(),
        total_price=rate_plan.price_per_night * nights,
        status=BookingStatus.CONFIRMED,
        created_by_id=user.id,
    )
    db.add(booking)
    db.commit()
    return _out(_get(db, booking.id))


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: int, db: DB, _: StaffUser) -> BookingOut:
    booking = _get(db, booking_id)
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status.HTTP_409_CONFLICT, "This booking is already cancelled")
    booking.status = BookingStatus.CANCELLED
    db.commit()
    return _out(booking)
