"""Business rules that more than one endpoint needs."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus


def booked_rooms(db: Session, room_type_id: int, check_in: date, check_out: date) -> int:
    """How many rooms of this type are taken on the busiest night of the requested stay.

    Two stays overlap when one starts before the other ends:
        existing.check_in < new.check_out  AND  existing.check_out > new.check_in
    (Checking out on the day someone else checks in is fine: the room is free that night.)

    We fetch only the overlapping bookings, then count night by night. Taking the busiest night
    matters: two guests on different nights both overlap a long stay, but they only ever use
    one room at a time.
    """
    stays = db.execute(
        select(Booking.check_in, Booking.check_out).where(
            Booking.room_type_id == room_type_id,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )
    ).all()
    busiest = 0
    night = check_in
    while night < check_out:
        in_use = sum(1 for start, end in stays if start <= night < end)
        busiest = max(busiest, in_use)
        night += timedelta(days=1)
    return busiest
