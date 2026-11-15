# Learning guide: how this project works

This guide walks through the project in the order a request travels: from the browser, to the API,
to the database and back. Each part has four sections:

- **The idea**: what the technology is for, in plain language
- **In this project**: where to look, and what to notice
- **Try it**: a small change to make yourself (this is how it sticks)
- **Interview questions**: what you're likely to be asked, with short answers

You already know JavaScript, React components, `useState` and `useEffect`. Everything here builds
on that.

---

## 0. The big picture

```
Browser (React)  ──HTTP + JSON──▶  API (FastAPI, Python)  ──SQL──▶  Database (PostgreSQL)
     ▲                                     │
     └──────────── JSON response ◀─────────┘
```

1. You click "Confirm booking".
2. React sends `POST /api/bookings` with the form data as JSON, plus your login token.
3. FastAPI checks the token, checks the data is valid, checks a room is free, saves the booking.
4. PostgreSQL stores it permanently.
5. The API answers with the new booking as JSON; React updates the screen.

The front end and back end are two separate programs. They only talk through the API, which is why
they can be hosted in different places (Vercel and Render).

**Run it:** `docker compose up --build`, then open <http://localhost:8080> (app) and
<http://localhost:8000/docs> (API docs: you can call every endpoint from there).

---

## 1. TypeScript

### The idea
TypeScript is JavaScript with labels saying what kind of value each thing is. If you say a hotel's
`stars` is a `number` and then write `hotel.starz`, TypeScript underlines it before you even run the
code. It disappears when the code is built: browsers still run plain JavaScript.

### In this project
- `frontend/src/lib/types.ts`: the shape of every object the API sends (`Hotel`, `Booking`...).
  They mirror the backend's `schemas.py`.
- Utility types: `Pick<Hotel, "name" | "city">` means "only these fields of Hotel";
  `Omit<RatePlan, "id">` means "all fields except id". Used for form inputs.
- Union types: `type BookingStatus = "confirmed" | "cancelled"`. Any other string is an error.
- Generics: `DataTable<T>` works for any row type; `http.get<Hotel[]>(...)` says what comes back.

### Try it
1. In `types.ts`, rename `guest_email` to `guestEmail` and run `npx tsc -b` in `frontend/`.
   See every place that breaks. Undo it.
2. Add `phone?: string` to `Booking`. The `?` makes it optional. Nothing breaks. Why?

### Interview questions
- **`type` vs `interface`?** Both describe object shapes. Interfaces can be extended and merged;
  `type` can also describe unions (`"a" | "b"`). Teams usually pick one style; this project uses
  `interface` for objects and `type` for unions and derived types.
- **What is a generic?** A type parameter, like a function argument but for types: `Array<T>`,
  `useState<string>()`, `DataTable<T>`.
- **`any` vs `unknown`?** `any` turns checking off. `unknown` means "could be anything, check
  before using it". Prefer `unknown` (see `readableError` in `api.ts`).

---

## 2. React, beyond useEffect

### The idea
Components, props and state you know. This project adds:
- **Context**: share a value (who's signed in) with every component without passing props down.
- **Custom hooks**: functions starting with `use` that bundle logic (`useAuth`, `useBookings`).
- **Routing**: different pages at different URLs without reloading.

### In this project
- `auth/AuthContext.tsx` provides the user; `auth/useAuth.ts` reads it. Any component can call
  `useAuth()` to get `user`, `isAdmin`, `signIn`, `signOut`.
- `App.tsx` defines the routes. `RequireAuth` redirects signed-out visitors to `/login` and remembers
  where they were going (`state.from`), so after signing in they land back there.
- `components/Layout.tsx` wraps every signed-in page. `<Outlet />` is where the current page appears.
- `components/ui.tsx` contains small reusable pieces (Button, Field, Modal) so every page is consistent.
- `Field` uses a **render prop**: `children` is a function that receives the generated `id`, so the
  label and input are always linked for screen readers.

### Try it
1. Add a "Profile" page at `/profile` that shows `user.full_name`, `user.email` and `user.role`
   using `useAuth()`. Add it to `links` in `Layout.tsx`.
2. Hide the "New booking" link for admins only (just to practise: `isAdmin`).

### Interview questions
- **Why context instead of props?** To avoid "prop drilling" a value through many layers that
  don't use it. Don't put fast-changing data in context: every consumer re-renders.
- **How do you protect a route?** A wrapper component that checks auth and renders
  `<Navigate to="/login" />` if needed (`RequireAuth`). The real protection is on the server.

---

## 3. TanStack Query (server data)

### The idea
Without it, every page does: `useEffect` → `fetch` → `setLoading` → `setData` → `setError`, and
data is re-downloaded on every visit. TanStack Query does all that for you and **caches** results:
- `useQuery` reads. It returns `{ data, isPending, error }`. Cached data shows instantly and is
  refreshed in the background.
- `useMutation` changes data (POST/PUT/DELETE). Afterwards we **invalidate** related queries so they
  re-fetch.
- Every query has a **key** like `["bookings", { status: "confirmed" }]`. Same key = same cache entry.

### In this project
- `frontend/src/lib/queries.ts` has every query and mutation in one place.
- **Optimistic update**: `useCancelBooking`. Read `onMutate`, `onError` and `onSettled` in order:
  1. `onMutate`: before the request, save the current lists and mark the booking "cancelled" in them.
  2. `onError`: if the server refuses, put the saved lists back.
  3. `onSettled`: either way, re-fetch so the screen matches the server.
- `useAvailability` uses `enabled` so it only asks once a room type and valid dates are chosen.
- `main.tsx` sets `staleTime: 30_000` (data is "fresh" for 30 s) and doesn't retry 4xx errors.

### Try it
1. Open the browser dev tools (Network tab), go to Bookings, then Hotels, then back to Bookings within
   30 seconds. Notice no new request the second time: that's the cache.
2. In `useCancelBooking`, temporarily change the URL to `/cancelx` (a 404). Click Cancel: the row
   flips to "cancelled" and then flips back. That's the rollback. Undo it.

### Interview questions
- **What is an optimistic update and when is it a bad idea?** Showing the result before the server
  confirms it. Great for likely-to-succeed actions (cancel, like, rename). Bad when failure is
  common or costly (payments).
- **What does invalidation do?** Marks cached data stale so it re-fetches (immediately if a component
  is showing it).
- **Why not just useEffect + fetch?** You'd hand-write loading/error states, caching, de-duplication,
  retries, and race-condition handling. The library does it consistently.

---

## 4. TanStack Table (the data grids)

### The idea
A "headless" table library: it handles the logic (sorting, filtering, which rows to show) and you
write the HTML. Version 9 makes you opt into each feature, so only what you use is bundled.

### In this project
- `components/tableFeatures.ts`: the features we use (sorting, global filter).
- `components/DataTable.tsx`: one reusable table. `useTable({ features, columns, data, state, ... })`
  then `table.getHeaderGroups()` and `table.getRowModel().rows` to render.
- `pages/BookingsPage.tsx`: columns are defined with `createColumnHelper`. `accessor` columns read a
  field; `display` columns (the Cancel button) don't.
- Sorting state is **controlled**: we keep it in `useState` and pass it to the table.

### Try it
1. Add a "Created by" column to the bookings table (`col.accessor("created_by", ...)`).
2. Make the hotels table start sorted by number of rooms, largest first:
   `initialSorting={[{ id: "total_rooms", desc: true }]}`.

### Interview questions
- **What does "headless" mean?** Logic without markup or styles, so it fits any design system.
- **Client-side vs server-side sorting?** We sort in the browser (fine for hundreds of rows). For
  millions, the API would sort and paginate (`manualSorting: true`).

---

## 5. Forms and validation (Zod)

### The idea
Zod describes what valid data looks like, then checks it: `z.email()`, `z.number().min(1)`.
`safeParse` returns either the clean data or a list of problems.

### In this project
- `components/HotelForm.tsx` and `pages/NewBookingPage.tsx` validate on submit, show each error
  under its field, and clear an error as soon as you edit that field.
- The `.refine(...)` in the booking schema checks two fields together (check-out after check-in).
- **The server checks everything again** (`schemas.py`), and the database has CHECK constraints.
  Front-end validation is for speed and friendliness; it is never the security boundary.

### Interview questions
- **Why validate twice?** Anyone can call the API directly (curl, Postman), skipping your UI.

---

## 6. Python and FastAPI (the API)

### The idea
FastAPI turns Python functions into HTTP endpoints. Type hints aren't just documentation: FastAPI
uses them to **validate** input, **convert** types and **generate** the docs at `/docs`.

```python
@router.post("/api/bookings", response_model=BookingOut, status_code=201)
def create_booking(body: BookingIn, db: DB, user: StaffUser) -> BookingOut:
```
Read it as: on `POST /api/bookings`, parse the JSON body into a `BookingIn` (or reply 422), give me a
database session, require a signed-in user, and the reply will look like `BookingOut`.

### In this project
- `app/main.py`: creates the app, adds CORS (which websites may call us), includes the routers.
- `app/routers/*.py`: one file per area. Read `bookings.py` `create_booking` top to bottom: it is the
  heart of the app.
- `app/schemas.py`: Pydantic models. `BookingIn` is what comes in; `BookingOut` is what goes out.
  `Money` stores exact decimals but sends plain numbers.
- `app/deps.py`: **dependencies**. `DB`, `StaffUser` and `AdminUser` are reusable "run this first"
  steps. Adding `user: AdminUser` to a function is all it takes to make it admin-only.
- Status codes used on purpose: 201 created, 204 deleted, 401 not signed in, 403 not allowed,
  404 not found, 409 conflict (sold out, already cancelled), 422 invalid input.

### Try it
1. Open <http://localhost:8000/docs>, click **Authorize**, sign in with the staff account, then try
   `GET /api/stats` and `POST /api/hotels` (you'll get 403: staff can't).
2. Add `GET /api/hotels/{hotel_id}/bookings-count` that returns `{"count": n}`.

### Interview questions
- **What is dependency injection in FastAPI?** Declaring what a function needs (a DB session, the
  current user) as parameters; FastAPI builds and passes them in, and tests can swap them
  (`app.dependency_overrides`, see `tests/conftest.py`).
- **401 vs 403?** 401: "who are you?" (no or bad token). 403: "I know who you are, and no."
- **What is CORS?** A browser rule: a page from site A can only call site B's API if B allows A.

---

## 7. SQL and PostgreSQL (the database)

### The idea
Data lives in tables with rows and columns. Tables link with **foreign keys** (a booking has a
`room_type_id`). SQLAlchemy lets us write Python classes instead of raw SQL, and Alembic keeps a
history of changes to the table structure (**migrations**).

### In this project
- `app/models.py`: the five tables and how they relate (diagram at the top of the file).
- Constraints the database enforces even if the code has a bug: `stars BETWEEN 1 AND 5`,
  `check_out > check_in`, `price_per_night > 0`, allowed values for `role` and `status`.
- `ondelete="CASCADE"` (deleting a hotel removes its room types) vs `"RESTRICT"` (a room type with
  bookings can't be deleted).
- `Numeric(10, 2)` for money: exact. Never use floats for money (0.1 + 0.2 ≠ 0.3).
- `alembic/versions/0001_initial_tables.py`: the migration that creates everything.
- `selectinload` / `joinedload` in the routers load related rows in one or two queries instead of
  one per row (avoids the "N+1 query" problem).

**The availability rule** (`app/services.py`): two stays overlap when
`existing.check_in < new.check_out AND existing.check_out > new.check_in`. Then we count night by
night and take the busiest night.

**The overbooking guard** (`create_booking`): `select(RoomType)...with_for_update()` runs
`SELECT ... FOR UPDATE`, which locks that room type's row until the booking is saved. A second
request for the same room type waits, then sees the first booking. We tested it: 10 simultaneous
requests for a single room produced exactly one booking.

### Try it
1. `docker compose exec db psql -U hotels` then `\dt`, then
   `SELECT guest_name, check_in, total_price FROM bookings ORDER BY total_price DESC LIMIT 5;`
2. Try to break a rule directly: `UPDATE hotels SET stars = 9 WHERE id = 1;` (the CHECK refuses).
3. Add a `phone` column: add it to `Booking` in `models.py`, run
   `alembic revision --autogenerate -m "booking phone"`, read the generated file, `alembic upgrade head`.

### Interview questions
- **What's a migration and why not just edit the table?** A versioned, repeatable change to the
  schema, applied the same way on every machine and in production.
- **What is a race condition here and how did you prevent it?** Two requests check availability at
  the same time, both see one room free, both book it. A row lock (`FOR UPDATE`) makes them take turns.
- **What is N+1?** Loading a list (1 query) and then each item's related data separately (N queries).
  Fixed with eager loading.

---

## 8. Login: JWT and roles

### The idea
- Passwords are stored as **hashes** (Argon2): a one-way scramble. We can check a password but never
  read it back.
- After a correct login the server signs a **JWT**, a token containing `{"sub": "2", "role": "staff",
  "exp": ...}`. The browser sends it as `Authorization: Bearer <token>` on every request. The server
  checks the signature with its secret, so it doesn't need to store sessions.

### In this project
- `app/security.py`: `hash_password`, `verify_password`, `create_access_token`, `decode_access_token`.
- `app/routers/auth.py`: login gives the same error for a wrong email or a wrong password, so attackers
  can't tell which emails exist.
- `app/deps.py`: `get_current_user` decodes the token and loads the user; `require_admin` adds the role
  check.
- Front end: `lib/api.ts` adds the header; a 401 response signs you out automatically.

### Interview questions
- **Where should a JWT be stored?** Trade-off. `localStorage` (used here, simple) can be read by
  injected scripts (XSS); an `HttpOnly` cookie can't be read by scripts but needs CSRF protection.
- **Can you revoke a JWT?** Not by itself, which is why they expire (8 hours here). For instant
  revocation you keep a deny-list or use short tokens with refresh tokens.
- **Why hash with Argon2 rather than SHA-256?** Argon2 is deliberately slow and memory-hungry, so
  guessing millions of passwords is impractical.

---

## 9. Testing

### The idea
Tests are code that checks code, so you can change things without fear.

### In this project
- `backend/tests/`: pytest. Each test gets a fresh in-memory SQLite database (`conftest.py`) and a
  test client that calls the API like a browser would. Read `test_bookings.py`: each test is a
  business rule written as code (prices, sold out, back-to-back stays, busiest night, cancelling).
- `frontend/src/**/*.test.ts(x)`: Vitest + React Testing Library. Tests interact like a user
  ("type in the search box", "click Sign in") and mock `fetch`.

### Try it
Write a backend test: an admin can't delete a rate plan that has bookings (expect 409).

### Interview questions
- **Unit vs integration vs end-to-end?** Unit: one function. Integration: pieces together (our API
  tests hit real endpoints and a real database). End-to-end: the whole app in a browser.
- **Why query by role/label in Testing Library?** It tests what users see, and it nudges you to
  write accessible markup.

---

## 10. Docker and deployment

### The idea
A container packages an app with everything it needs, so "works on my machine" works everywhere.
`docker compose` starts several containers that can talk to each other.

### In this project
- `backend/Dockerfile`: Python image → install requirements → copy code → run `start.sh`
  (migrations, optional demo data, then the server). Runs as a non-root user.
- `frontend/Dockerfile`: a **multi-stage** build. Stage 1 uses Node to build the app; stage 2 copies
  only the built files into a tiny nginx image.
- `docker-compose.yml`: `db` (Postgres with a health check) → `api` (waits for a healthy db) →
  `web` (waits for a healthy api).
- Production: Neon (database), Render (`render.yaml`, runs the same backend Dockerfile), Vercel
  (front end, `vercel.json` sends every path to `index.html` so React Router can handle it).
- `.github/workflows/ci.yml`: runs both test suites on every push.

### Interview questions
- **Image vs container?** An image is the recipe/snapshot; a container is a running instance of it.
- **Why multi-stage builds?** The final image has only what it needs to run, not build tools.
- **How does the front end know where the API is?** `VITE_API_URL` is baked in at build time.
- **What happens on a cold start on Render's free plan?** The service sleeps after inactivity; the
  first request wakes it (up to a minute). The UI says so if it can't connect.

---

## How to talk about this project (30-second version)

> "It's a hotel booking manager I built end to end. React and TypeScript on the front, with TanStack
> Query for server state, including optimistic updates, and TanStack Table for sortable, filterable
> grids. The API is FastAPI with PostgreSQL through SQLAlchemy and Alembic, JWT auth with admin and
> staff roles, and it's tested with pytest and Vitest in CI. The interesting part is availability:
> the server checks the busiest night of a stay and locks the room type row while booking, so two
> people can't take the last room at the same time. I tested that with ten simultaneous requests.
> It runs with one `docker compose up` and is deployed on Vercel, Render and Neon."

Practise saying it out loud, then be ready to open any file and explain it.
