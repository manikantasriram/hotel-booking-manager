"""The FastAPI app: wires the routers together and allows the front end to call it.

Run locally:  uvicorn app.main:app --reload
Then open http://localhost:8000/docs for interactive API docs.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Small, safe defaults for every response. (The API only returns JSON and the /docs page.)"""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.exception_handler(IntegrityError)
def integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
    """A database rule said no (for example, something was deleted while still in use).
    Answer 409 with a plain message instead of a bare 500 error."""
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "That change conflicts with existing data. Refresh and try again."},
    )

for r in (auth.router, hotels.router, inventory.router, bookings.router, stats.router):
    app.include_router(r)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    """Used by Render and Docker to check the API is up."""
    return {"status": "ok"}
