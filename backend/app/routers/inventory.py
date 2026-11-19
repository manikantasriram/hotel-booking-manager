"""Room types and rate plans: what a hotel sells, and at what price. Admin-only to change."""

from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.deps import DB, AdminUser, StaffUser
from app.models import Booking, Hotel, RatePlan, RoomType
from app.schemas import (
    Availability,
    RatePlanIn,
    RatePlanOut,
    RatePlanUpdate,
    RoomTypeIn,
    RoomTypeOut,
    RoomTypeUpdate,
)
from app.services import MAX_NIGHTS, booked_rooms

router = APIRouter(prefix="/api", tags=["room types & rate plans"])


def _room_type(db: DB, room_type_id: int) -> RoomType:
    rt = db.get(RoomType, room_type_id)
    if rt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Room type not found")
    return rt


def _rate_plan(db: DB, rate_plan_id: int) -> RatePlan:
    rp = db.get(RatePlan, rate_plan_id)
    if rp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rate plan not found")
    return rp


# ---------- room types ----------
@router.post("/room-types", response_model=RoomTypeOut, status_code=status.HTTP_201_CREATED)
def create_room_type(body: RoomTypeIn, db: DB, _: AdminUser) -> RoomType:
    if db.get(Hotel, body.hotel_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hotel not found")
    rt = RoomType(**body.model_dump())
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


@router.put("/room-types/{room_type_id}", response_model=RoomTypeOut)
def update_room_type(room_type_id: int, body: RoomTypeUpdate, db: DB, _: AdminUser) -> RoomType:
    # Same lock as booking: no new booking can slip in while we check the new room count.
    rt = db.scalar(select(RoomType).where(RoomType.id == room_type_id).with_for_update())
    if rt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Room type not found")
    if body.total_rooms < rt.total_rooms:
        # Don't allow fewer rooms than are already booked on any night from today on.
        busiest = booked_rooms(db, rt.id, date.today(), date.max)
        if body.total_rooms < busiest:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{busiest} rooms of this type are already booked on one night, so it needs at least {busiest}",
            )
    for field, value in body.model_dump().items():
        setattr(rt, field, value)
    db.commit()
    db.refresh(rt)
    return rt


@router.delete("/room-types/{room_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room_type(room_type_id: int, db: DB, _: AdminUser) -> None:
    rt = _room_type(db, room_type_id)
    if db.scalar(select(func.count(Booking.id)).where(Booking.room_type_id == room_type_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This room type has bookings, so it can't be deleted")
    db.delete(rt)
    db.commit()


@router.get("/room-types/{room_type_id}/availability", response_model=Availability)
def availability(
    room_type_id: int,
    db: DB,
    _: StaffUser,
    check_in: date = Query(),
    check_out: date = Query(),
) -> Availability:
    if check_out <= check_in:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Check-out must be after check-in")
    if (check_out - check_in).days > MAX_NIGHTS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Check at most {MAX_NIGHTS} nights at a time")
    rt = _room_type(db, room_type_id)
    booked = booked_rooms(db, room_type_id, check_in, check_out)
    return Availability(
        room_type_id=rt.id,
        check_in=check_in,
        check_out=check_out,
        total_rooms=rt.total_rooms,
        booked=booked,
        available=max(0, rt.total_rooms - booked),
    )


# ---------- rate plans ----------
@router.post("/rate-plans", response_model=RatePlanOut, status_code=status.HTTP_201_CREATED)
def create_rate_plan(body: RatePlanIn, db: DB, _: AdminUser) -> RatePlan:
    _room_type(db, body.room_type_id)
    rp = RatePlan(**body.model_dump())
    db.add(rp)
    db.commit()
    return rp


@router.put("/rate-plans/{rate_plan_id}", response_model=RatePlanOut)
def update_rate_plan(rate_plan_id: int, body: RatePlanUpdate, db: DB, _: AdminUser) -> RatePlan:
    rp = _rate_plan(db, rate_plan_id)
    for field, value in body.model_dump().items():
        setattr(rp, field, value)
    db.commit()
    return rp


@router.delete("/rate-plans/{rate_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rate_plan(rate_plan_id: int, db: DB, _: AdminUser) -> None:
    rp = _rate_plan(db, rate_plan_id)
    if db.scalar(select(func.count(Booking.id)).where(Booking.rate_plan_id == rate_plan_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This rate plan has bookings, so it can't be deleted")
    db.delete(rp)
    db.commit()
