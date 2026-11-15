"""Fill the database with demo hotels, rates, bookings and two demo logins.

    python -m app.seed          # only seeds an empty database
    python -m app.seed --reset  # wipes the data and seeds again (handy for the public demo)

Bookings are placed around today's date, so the dashboard always has something to show.
"""

import argparse
import random
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import Booking, BookingStatus, Hotel, RatePlan, Role, RoomType, User
from app.security import hash_password

DEMO_USERS = [
    ("admin@demo.dev", "Asha Admin", Role.ADMIN, "admin-demo-2026"),
    ("staff@demo.dev", "Sam Staff", Role.STAFF, "staff-demo-2026"),
]

# hotel: (name, city, address, stars, description, [(room type, capacity, rooms, base price)])
HOTELS = [
    (
        "The Banjara Courtyard", "Hyderabad", "Road No. 12, Banjara Hills", 5,
        "A quiet courtyard hotel ten minutes from the old city.",
        [("Deluxe King", 2, 18, 7800), ("Executive Suite", 3, 6, 14500), ("Family Room", 4, 8, 10200)],
    ),
    (
        "Marine Drive Residency", "Mumbai", "Netaji Subhash Chandra Bose Road", 4,
        "Sea-facing rooms on the Queen's Necklace.",
        [("Sea View Double", 2, 24, 9600), ("City View Twin", 2, 20, 6900)],
    ),
    (
        "Cubbon Park Inn", "Bengaluru", "Kasturba Road", 3,
        "A friendly business hotel next to Cubbon Park.",
        [("Standard Queen", 2, 30, 4200), ("Studio Apartment", 3, 10, 6100)],
    ),
    (
        "Backwater Retreat", "Alleppey", "Punnamada, Finishing Point", 4,
        "Lake-side cottages and a houseboat jetty.",
        [("Lake Cottage", 2, 12, 8800), ("Garden Villa", 4, 5, 13900)],
    ),
]

BOOKINGS = 220

GUESTS = [
    "Priya Sharma", "Rahul Verma", "Ananya Iyer", "Vikram Rao", "Neha Gupta", "Arjun Nair",
    "Kavya Reddy", "Rohan Mehta", "Isha Kapoor", "Aditya Singh", "Meera Pillai", "Karthik Menon",
    "Sneha Das", "Farhan Ali", "Divya Joshi", "Nikhil Bose", "Pooja Kulkarni", "Siddharth Jain",
]


def _rate_plans(room_type: RoomType, base: int) -> None:
    room_type.rate_plans = [
        RatePlan(name="Flexible, room only", price_per_night=Decimal(base), refundable=True),
        RatePlan(
            name="Flexible, breakfast included",
            price_per_night=Decimal(round(base * 1.15)),
            breakfast_included=True,
        ),
        RatePlan(name="Non-refundable saver", price_per_night=Decimal(round(base * 0.85)), refundable=False),
    ]


def seed(reset: bool = False) -> None:
    rng = random.Random(2026)  # fixed seed: the same demo data every time
    with SessionLocal() as db:
        if reset:
            for table in (Booking, RatePlan, RoomType, Hotel, User):
                db.execute(delete(table))
            db.commit()
        elif db.scalar(select(User.id).limit(1)) is not None:
            print("Database already has data; nothing to do. Use --reset to start over.")
            return

        users = [
            User(email=email, full_name=name, role=role, hashed_password=hash_password(password))
            for email, name, role, password in DEMO_USERS
        ]
        db.add_all(users)

        room_types: list[RoomType] = []
        for name, city, address, stars, description, rooms in HOTELS:
            hotel = Hotel(name=name, city=city, address=address, stars=stars, description=description)
            for rt_name, capacity, total, base in rooms:
                rt = RoomType(name=rt_name, capacity=capacity, total_rooms=total)
                _rate_plans(rt, base)
                hotel.room_types.append(rt)
                room_types.append(rt)
            db.add(hotel)
        db.flush()  # assigns ids

        today = date.today()
        for i in range(BOOKINGS):
            rt = rng.choice(room_types)
            plan = rng.choice(rt.rate_plans)
            check_in = today + timedelta(days=rng.randint(-6, 30))
            nights = rng.randint(1, 5)
            guest = GUESTS[i % len(GUESTS)]
            db.add(
                Booking(
                    room_type_id=rt.id,
                    rate_plan_id=plan.id,
                    guest_name=guest,
                    guest_email=guest.lower().replace(" ", ".") + "@example.com",
                    check_in=check_in,
                    check_out=check_in + timedelta(days=nights),
                    guests=rng.randint(1, rt.capacity),
                    status=BookingStatus.CANCELLED if rng.random() < 0.12 else BookingStatus.CONFIRMED,
                    total_price=plan.price_per_night * nights,
                    created_by_id=rng.choice(users).id,
                )
            )
        db.commit()
        print(f"Seeded {len(HOTELS)} hotels, {len(room_types)} room types, {BOOKINGS} bookings and 2 demo users.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="wipe existing data first")
    seed(parser.parse_args().reset)
