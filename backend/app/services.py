"""Business rules that more than one endpoint needs."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus

MAX_NIGHTS = 60  # longest stay (and longest availability check) we accept


def booked_rooms(db: Session, room_type_id: int, check_in: date, check_out: date) -> int:
    """How many rooms of this type are taken on the busiest night of the requested stay.

    Two stays overlap when one starts before the other ends:
        existing.check_in < new.check_out  AND  existing.check_out > new.check_in
    (Checking out on the day someone else checks in is fine: the room is free that night.)

    Taking the busiest night matters: two guests on different nights both overlap a long stay,
    but they only ever use one room at a time.

    How: treat each overlapping stay as +1 room on its first night and -1 on its check-out day,
    sort those events by date and keep a running total. The highest total is the busiest night.
    The work depends only on how many bookings overlap, not on how long the date range is.
    """
    stays = db.execute(
        select(Booking.check_in, Booking.check_out).where(
            Booking.room_type_id == room_type_id,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )
    ).all()
    events: list[tuple[date, int]] = []
    for start, end in stays:
        events.append((max(start, check_in), +1))  # count only nights inside the requested range
        events.append((min(end, check_out), -1))
    # On the same date, check-outs (-1) come before check-ins (+1): that room is free again tonight.
    events.sort(key=lambda e: (e[0], e[1]))
    busiest = in_use = 0
    for _, change in events:
        in_use += change
        busiest = max(busiest, in_use)
    return busiest
