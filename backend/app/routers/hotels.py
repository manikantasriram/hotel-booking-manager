from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.deps import DB, AdminUser, StaffUser
from app.models import Booking, Hotel, RoomType
from app.schemas import HotelDetail, HotelIn, HotelOut

router = APIRouter(prefix="/api/hotels", tags=["hotels"])


def _get_hotel(db: DB, hotel_id: int) -> Hotel:
    hotel = db.scalar(
        select(Hotel)
        .where(Hotel.id == hotel_id)
        # load room types and their rate plans in two extra queries, not one per room type
        .options(selectinload(Hotel.room_types).selectinload(RoomType.rate_plans))
    )
    if hotel is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hotel not found")
    return hotel


def _summary(hotel: Hotel) -> dict:
    return {
        "room_type_count": len(hotel.room_types),
        "total_rooms": sum(rt.total_rooms for rt in hotel.room_types),
    }


@router.get("", response_model=list[HotelOut])
def list_hotels(db: DB, _: StaffUser) -> list[HotelOut]:
    hotels = db.scalars(select(Hotel).options(selectinload(Hotel.room_types)).order_by(Hotel.name)).all()
    return [HotelOut.model_validate(h).model_copy(update=_summary(h)) for h in hotels]


@router.get("/{hotel_id}", response_model=HotelDetail)
def get_hotel(hotel_id: int, db: DB, _: StaffUser) -> HotelDetail:
    hotel = _get_hotel(db, hotel_id)
    return HotelDetail.model_validate(hotel).model_copy(update=_summary(hotel))


@router.post("", response_model=HotelOut, status_code=status.HTTP_201_CREATED)
def create_hotel(body: HotelIn, db: DB, _: AdminUser) -> HotelOut:
    hotel = Hotel(**body.model_dump())
    db.add(hotel)
    db.commit()
    return HotelOut.model_validate(hotel)


@router.put("/{hotel_id}", response_model=HotelOut)
def update_hotel(hotel_id: int, body: HotelIn, db: DB, _: AdminUser) -> HotelOut:
    hotel = _get_hotel(db, hotel_id)
    for field, value in body.model_dump().items():
        setattr(hotel, field, value)
    db.commit()
    return HotelOut.model_validate(hotel).model_copy(update=_summary(hotel))


@router.delete("/{hotel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hotel(hotel_id: int, db: DB, _: AdminUser) -> None:
    hotel = _get_hotel(db, hotel_id)
    has_bookings = db.scalar(
        select(func.count(Booking.id)).join(RoomType).where(RoomType.hotel_id == hotel_id)
    )
    if has_bookings:
        raise HTTPException(status.HTTP_409_CONFLICT, "This hotel has bookings, so it can't be deleted")
    db.delete(hotel)
    db.commit()
