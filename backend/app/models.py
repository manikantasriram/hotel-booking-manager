"""Database tables, written as Python classes (SQLAlchemy ORM).

    Hotel 1──* RoomType 1──* RatePlan
                  │
                  └──* Booking *── User (who made it)

A room type ("Deluxe King") has a number of identical rooms. A rate plan is a price you can
sell it at ("Flexible, breakfast included"). A booking reserves one room of a room type, at
one rate plan, for a range of nights.
"""

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Role(enum.StrEnum):
    ADMIN = "admin"  # manages hotels, room types and rate plans
    STAFF = "staff"  # handles bookings


class BookingStatus(enum.StrEnum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


# Store enums as plain text with a CHECK constraint: portable and easy to read in SQL.
def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(
        e,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda x: [m.value for m in x],
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(_enum(Role, "user_role"))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Hotel(Base):
    __tablename__ = "hotels"
    __table_args__ = (CheckConstraint("stars BETWEEN 1 AND 5", name="ck_hotels_stars"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80), index=True)
    address: Mapped[str] = mapped_column(String(255))
    stars: Mapped[int]
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Deleting a hotel removes its room types (and their rate plans) too.
    room_types: Mapped[list["RoomType"]] = relationship(
        back_populates="hotel", cascade="all, delete-orphan", order_by="RoomType.id"
    )


class RoomType(Base):
    __tablename__ = "room_types"
    __table_args__ = (
        CheckConstraint("capacity >= 1", name="ck_room_types_capacity"),
        CheckConstraint("total_rooms >= 1", name="ck_room_types_total_rooms"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    capacity: Mapped[int]  # guests per room
    total_rooms: Mapped[int]  # how many identical rooms of this type the hotel has

    hotel: Mapped[Hotel] = relationship(back_populates="room_types")
    rate_plans: Mapped[list["RatePlan"]] = relationship(
        back_populates="room_type", cascade="all, delete-orphan", order_by="RatePlan.id"
    )


class RatePlan(Base):
    __tablename__ = "rate_plans"
    __table_args__ = (CheckConstraint("price_per_night > 0", name="ck_rate_plans_price"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    breakfast_included: Mapped[bool] = mapped_column(default=False)
    refundable: Mapped[bool] = mapped_column(default=True)

    room_type: Mapped[RoomType] = relationship(back_populates="rate_plans")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("check_out > check_in", name="ck_bookings_dates"),
        CheckConstraint("guests >= 1", name="ck_bookings_guests"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # RESTRICT: a room type that still has bookings can't be deleted by accident.
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id", ondelete="RESTRICT"), index=True)
    rate_plan_id: Mapped[int] = mapped_column(ForeignKey("rate_plans.id", ondelete="RESTRICT"))
    guest_name: Mapped[str] = mapped_column(String(120))
    guest_email: Mapped[str] = mapped_column(String(255))
    check_in: Mapped[date] = mapped_column(Date, index=True)
    check_out: Mapped[date] = mapped_column(Date, index=True)
    guests: Mapped[int]
    status: Mapped[BookingStatus] = mapped_column(
        _enum(BookingStatus, "booking_status"), default=BookingStatus.CONFIRMED, index=True
    )
    # Price is fixed when the booking is made, so later rate changes don't alter it.
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    room_type: Mapped[RoomType] = relationship()
    rate_plan: Mapped[RatePlan] = relationship()
    created_by: Mapped[User | None] = relationship()

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days
