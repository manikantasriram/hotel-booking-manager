"""The FastAPI app: wires the routers together and allows the front end to call it.

Run locally:  uvicorn app.main:app --reload
Then open http://localhost:8000/docs for interactive API docs.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, bookings, hotels, inventory, stats

app = FastAPI(
    title="Hotel Rate & Booking Manager API",
    version="1.0.0",
    description="Manage hotels, room types, rate plans and bookings. Sign in via /api/auth/login.",
)

# CORS: browsers block calls from one site (the front end) to another (this API) unless the
# API says that site is allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

for r in (auth.router, hotels.router, inventory.router, bookings.router, stats.router):
    app.include_router(r)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    """Used by Render and Docker to check the API is up."""
    return {"status": "ok"}
