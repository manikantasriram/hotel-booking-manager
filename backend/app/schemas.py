"""Request and response shapes (Pydantic).

These are the "contract" of the API: FastAPI validates every incoming body against them and
uses them to build the interactive docs at /docs. Models (models.py) describe tables;
schemas describe what goes over the wire. Keeping them separate means a password hash can
never leak into a response by accident.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, StringConstraints, model_validator

from app.models import BookingStatus, Role

# Money is stored exactly (Decimal) but sent to the browser as a plain JSON number.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class ORM(BaseModel):
    """Lets a schema be built straight from a database object."""

    model_config = ConfigDict(from_attributes=True)


# ---------- auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(ORM):
    id: int
    email: EmailStr
    full_name: str
    role: Role


# ---------- hotels ----------
class HotelIn(BaseModel):
    name: Name
    city: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    stars: Annotated[int, Field(ge=1, le=5)]
    description: Annotated[str, Field(max_length=2000)] = ""


class HotelOut(ORM):
    id: int
    name: str
    city: str
    address: str
    stars: int
    description: str
    room_type_count: int = 0
    total_rooms: int = 0


# ---------- room types ----------
class RoomTypeIn(BaseModel):
    hotel_id: int
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    capacity: Annotated[int, Field(ge=1, le=12)]
    total_rooms: Annotated[int, Field(ge=1, le=1000)]


class RoomTypeUpdate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    capacity: Annotated[int, Field(ge=1, le=12)]
    total_rooms: Annotated[int, Field(ge=1, le=1000)]


class RatePlanOut(ORM):
    id: int
    room_type_id: int
    name: str
    price_per_night: Money
    breakfast_included: bool
    refundable: bool


class RoomTypeOut(ORM):
    id: int
    hotel_id: int
    name: str
    capacity: int
    total_rooms: int
    rate_plans: list[RatePlanOut] = []


class HotelDetail(HotelOut):
    room_types: list[RoomTypeOut] = []


# ---------- rate plans ----------
class RatePlanIn(BaseModel):
    room_type_id: int
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    price_per_night: Annotated[Decimal, Field(gt=0, le=1_000_000, decimal_places=2)]
    breakfast_included: bool = False
    refundable: bool = True


class RatePlanUpdate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    price_per_night: Annotated[Decimal, Field(gt=0, le=1_000_000, decimal_places=2)]
    breakfast_included: bool
    refundable: bool


# ---------- bookings ----------
class BookingIn(BaseModel):
    room_type_id: int
    rate_plan_id: int
    guest_name: Name
    guest_email: EmailStr
    check_in: date
    check_out: date
    guests: Annotated[int, Field(ge=1, le=12)]

    @model_validator(mode="after")
    def check_dates(self) -> "BookingIn":
        if self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in")
        if (self.check_out - self.check_in).days > 60:
            raise ValueError("A booking can be at most 60 nights")
        return self


class BookingOut(ORM):
    id: int
    room_type_id: int
    rate_plan_id: int
    hotel_id: int
    hotel_name: str
    room_type_name: str
    rate_plan_name: str
    guest_name: str
    guest_email: str
    check_in: date
    check_out: date
    nights: int
    guests: int
    status: BookingStatus
    total_price: Money
    created_by: str | None
    created_at: datetime


class Availability(BaseModel):
    room_type_id: int
    check_in: date
    check_out: date
    total_rooms: int
    booked: int
    available: int


# ---------- dashboard ----------
class Stats(BaseModel):
    hotels: int
    rooms: int
    arrivals_today: int
    occupied_tonight: int
    occupancy_tonight: float  # 0..1
    upcoming_bookings: int
    revenue_next_30_days: float
