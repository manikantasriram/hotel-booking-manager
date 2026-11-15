# Learning guide

This guide explains how the Hotel Rate & Booking Manager works, in plain language, so you can
explain it, change it and answer interview questions about it.

**You already know:** JavaScript, React components, props, `useState`, `useEffect`.
**Everything else is explained here from scratch.**

## How to use this guide

Work through it in order. Each part takes 20–45 minutes. Keep the app running while you read
(`docker compose up --build`, then open <http://localhost:8080>) and open each file mentioned.

| Part | Topic | You'll be able to explain |
| --- | --- | --- |
| 1 | The big picture | how the browser, API and database work together |
| 2 | Follow one booking | what happens, file by file, when you click "Confirm booking" |
| 3 | TypeScript | why the code has types and how to read them |
| 4 | React patterns | context, custom hooks, routing, reusable components |
| 5 | TanStack Query | loading and saving server data, caching, optimistic updates |
| 6 | TanStack Table | sortable, searchable data grids |
| 7 | Forms and Zod | validating input and showing errors |
| 8 | Python and FastAPI | how the API is built |
| 9 | PostgreSQL, SQLAlchemy, Alembic | tables, relationships, migrations, the double-booking guard |
| 10 | Login, JWT and roles | how sign-in and permissions work |
| 11 | Testing | how the tests prove the rules |
| 12 | Docker and deployment | how it runs locally and online |
| 13 | Practice and interview prep | exercises, and what to say |

Every part ends with **Check yourself** questions. If you can answer them out loud without looking,
you've got it.

---

## Part 1. The big picture

```
 Browser                         API                              Database
 ┌──────────────────┐   HTTP    ┌───────────────────────┐   SQL   ┌──────────────┐
 │ React app        │ ────────▶ │ FastAPI (Python)      │ ──────▶ │ PostgreSQL   │
 │ (what you see)   │ ◀──────── │ (rules and security)  │ ◀────── │ (stores data)│
 └──────────────────┘   JSON    └───────────────────────┘         └──────────────┘
   Vercel                          Render                            Neon
```

- **Front end** (`frontend/`): the screens. Runs in the visitor's browser. It never touches the
  database directly; it can only ask the API.
- **Back end / API** (`backend/`): the rules. Checks who you are, whether you're allowed, whether
  the data makes sense, then reads or writes the database.
- **Database**: stores hotels, rooms, prices, bookings and users permanently.

They talk using **HTTP requests** carrying **JSON** (text that looks like a JavaScript object):

```
POST /api/bookings
Authorization: Bearer eyJhbGci...          ← "this is who I am"
{ "room_type_id": 3, "guest_name": "Priya Sharma", "check_in": "2026-11-20", ... }
```

### Words you'll see a lot

| Word | Meaning |
| --- | --- |
| **API** | The set of URLs the front end can call, like `GET /api/hotels`. |
| **Endpoint** | One of those URLs plus its method (GET, POST, PUT, DELETE). |
| **GET / POST / PUT / DELETE** | Read / create / replace / delete. |
| **Status code** | The number in every response: 200 OK, 201 created, 204 deleted, 401 not signed in, 403 not allowed, 404 not found, 409 conflict, 422 invalid input. |
| **JSON** | The data format sent back and forth. |
| **Token (JWT)** | A signed "ID card" the server gives you at sign-in. You send it with every request. |
| **Schema** | A description of what data must look like. |
| **ORM** | A library that lets you use Python classes instead of writing SQL by hand. |
| **Migration** | A saved, repeatable change to the database's tables. |
| **Container** | A packaged app with everything it needs to run, anywhere. |

### Check yourself
1. Why can't the React app talk to the database directly?
2. What does a 403 tell you that a 401 doesn't?

---

## Part 2. Follow one booking, from click to database

This is the most useful part. Open each file as you read.

**1. You fill in the form** in `frontend/src/pages/NewBookingPage.tsx`.
Each field is controlled by React state (`form`). Choosing a room type and dates triggers
`useAvailability(...)`, which asks the API how many rooms are free and shows "16 of 18 rooms free".

**2. You click "Confirm booking".** The `submit` function runs:
```tsx
const parsed = bookingSchema.safeParse(form);   // Zod checks the form
if (!parsed.success) { ... show errors under each field ...; return; }
create.mutate(parsed.data, { onSuccess: () => navigate("/bookings") });
```

**3. `create` is a TanStack Query mutation** from `frontend/src/lib/queries.ts`:
```ts
mutationFn: (body: BookingInput) => http.post<Booking>("/api/bookings", body),
```

**4. `http.post` is our fetch wrapper** in `frontend/src/lib/api.ts`. It adds the login token,
sends JSON, and turns any error into a readable message:
```ts
if (token) headers.set("Authorization", `Bearer ${token}`);
res = await fetch(`${API_URL}${path}`, { ...init, headers });
```

**5. The request arrives at FastAPI**, in `backend/app/routers/bookings.py`:
```python
@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(body: BookingIn, db: DB, user: StaffUser) -> BookingOut:
```
Before this function runs, FastAPI has already:
- turned the JSON into a `BookingIn` object and checked every field (`schemas.py`), or replied 422;
- opened a database session (`DB`);
- checked the token and loaded the user (`StaffUser`, in `deps.py`), or replied 401.

**6. The function applies the business rules**, in this order:
```python
room_type = db.scalar(select(RoomType).where(...).with_for_update())  # lock this room type
# rate plan must belong to this room type          → else 422
# guests must fit the room's capacity               → else 422
# booked_rooms(...) must be below total_rooms       → else 409 "sold out"
booking = Booking(..., total_price=rate_plan.price_per_night * nights)
db.add(booking); db.commit()                        # saved; the lock is released
```

**7. PostgreSQL saves the row.** Its own rules (CHECK constraints such as
`check_out > check_in`) act as a final safety net.

**8. The API replies `201 Created`** with the new booking as JSON.

**9. Back in the browser**, the mutation's `onSuccess` invalidates the cached bookings, availability
and stats, so those screens refresh, and the page navigates to `/bookings` where the new booking appears.

### Check yourself
1. Name the three places where input is validated, and why each one exists.
2. What exactly happens if two people try to book the last room at the same moment?

---

## Part 3. TypeScript

**In one sentence:** JavaScript with labels saying what type each value is, checked before the code runs.

**Why we use it:** typos and wrong shapes are caught while you type, not by users.

**Where to look:** `frontend/src/lib/types.ts` describes every object the API sends. It mirrors
`backend/app/schemas.py`.

**Read this:**
```ts
export type BookingStatus = "confirmed" | "cancelled";      // only these two strings are allowed
export interface Booking { id: number; guest_name: string; status: BookingStatus; ... }
export type HotelInput = Pick<Hotel, "name" | "city" | "address" | "stars" | "description">;
```
- `type A = "x" | "y"` is a **union**: one of a fixed set of values.
- `interface` describes an object's shape.
- `Pick<T, keys>` makes a new type with only some fields; `Omit<T, keys>` with all but some.
- **Generics** are type parameters: `http.get<Hotel[]>(...)` says "this returns a list of hotels".

**Try it:** in `types.ts`, rename `guest_email` to `guestEmail`, run `npx tsc -b` in `frontend/`,
and see every place that breaks. Then undo it.

### Check yourself
1. What's the difference between `any` and `unknown`? (`any` switches checking off; `unknown`
   forces you to check before use. We use `unknown` for error bodies in `api.ts`.)
2. What does `Pick<Hotel, "name">` produce?

---

## Part 4. React patterns

**Context** shares a value with every component without passing props down.
`frontend/src/auth/AuthContext.tsx` provides the signed-in user; any component calls
`useAuth()` (`auth/useAuth.ts`) to get `user`, `isAdmin`, `signIn` and `signOut`.

**Custom hooks** are functions starting with `use` that bundle logic. `useAuth`, `useBookings` and
`useHotels` are all custom hooks.

**Routing** shows different pages at different URLs. `frontend/src/App.tsx`:
```tsx
<Route path="/login" element={<LoginPage />} />
<Route element={<RequireAuth><Layout /></RequireAuth>}>
  <Route index element={<DashboardPage />} />
  <Route path="bookings" element={<BookingsPage />} />
  ...
```
`RequireAuth` sends signed-out visitors to `/login` and remembers where they were going.
`Layout` is the frame (sidebar) around every page; `<Outlet />` is where the page appears.

**Reusable components** in `components/ui.tsx` (Button, Field, Modal) keep every screen consistent.
`Modal` uses the browser's built-in `<dialog>`, which handles focus and the Escape key for free.

**Try it:** add a "Profile" page at `/profile` that shows the user's name, email and role using
`useAuth()`, and add it to the `links` list in `components/Layout.tsx`.

### Check yourself
1. Why use context for the signed-in user instead of props?
2. Hiding the "Add hotel" button from staff: is that security? (No. The API is the real guard;
   hiding is just good UX.)

---

## Part 5. TanStack Query (server data)

**In one sentence:** it fetches, caches and refreshes server data, so you don't hand-write
loading/error state with `useEffect`.

**Without it** every page would need: `useEffect` → `fetch` → `setLoading` → `setData` → `setError`,
and would re-download data on every visit.

**The two tools:**
- `useQuery` reads data and gives you `{ data, isPending, error }`.
- `useMutation` changes data. Afterwards you **invalidate** related queries so they re-fetch.

Every query has a **key** that names its cache entry: `["bookings", { status: "confirmed" }]`.

**Where to look:** `frontend/src/lib/queries.ts` holds every query and mutation.

**The optimistic update** (`useCancelBooking`). Read the three steps in order:
```ts
onMutate: async (id) => {            // 1. BEFORE the request
  await qc.cancelQueries({ queryKey: ["bookings"] });
  const previous = qc.getQueriesData<Booking[]>({ queryKey: ["bookings"] });   // remember
  qc.setQueriesData(..., list => list?.map(b => b.id === id ? { ...b, status: "cancelled" } : b));
  return { previous };
},
onError: (_err, _id, context) => {   // 2. if the server refuses: put the old data back
  context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
},
onSettled: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); }   // 3. re-sync either way
```

**Try it:**
1. Open dev tools → Network. Visit Bookings, then Hotels, then Bookings again within 30 seconds.
   No new request the second time: that's the cache (`staleTime: 30_000` in `main.tsx`).
2. Temporarily change the cancel URL to `/cancelx`. Click Cancel: the row flips to "cancelled",
   then flips back. That's the rollback. Undo it.

### Check yourself
1. When is an optimistic update a bad idea? (When failure is likely or costly, such as payments.)
2. What does "invalidate" do?

---

## Part 6. TanStack Table (data grids)

**In one sentence:** a "headless" table library: it does the sorting and filtering logic, and you
write the HTML and styles.

**Where to look:**
- `components/tableFeatures.ts` lists the features we switched on (sorting, search). Version 9 only
  bundles features you ask for.
- `components/DataTable.tsx` is one reusable table used by both the Hotels and Bookings pages.
- `pages/BookingsPage.tsx` defines the columns:
```tsx
col.accessor("check_in", { header: "Check-in", cell: (info) => formatDate(info.getValue()) }),
col.display({ id: "actions", cell: ({ row }) => <Button ...>Cancel</Button> }),
```
`accessor` columns show a field; `display` columns show something else (here, a button).

**Try it:** add a "Created by" column to the bookings table using `col.accessor("created_by", ...)`.

### Check yourself
1. What does "headless" mean, and why is it useful?
2. When would you sort on the server instead of in the browser? (When there are too many rows to
   send to the browser at once.)

---

## Part 7. Forms and Zod

**In one sentence:** Zod describes what valid input looks like and checks it, giving you either clean
data or a list of problems.

```ts
const hotelSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  stars: z.coerce.number().int().min(1).max(5),
});
const parsed = hotelSchema.safeParse(values);
```

**Where to look:** `components/HotelForm.tsx` and `pages/NewBookingPage.tsx`. Errors show under
each field and disappear as soon as you edit that field. `.refine(...)` checks two fields together
(check-out after check-in).

**Important:** this is for speed and friendliness only. Anyone can call the API directly, skipping
the form, so the API validates everything again.

### Check yourself
1. Why validate on both the front end and the back end?

---

## Part 8. Python and FastAPI

**In one sentence:** FastAPI turns Python functions into API endpoints, and uses their type hints to
validate input and write the docs at `/docs` automatically.

**Read one endpoint** (`backend/app/routers/hotels.py`):
```python
@router.post("", response_model=HotelOut, status_code=status.HTTP_201_CREATED)
def create_hotel(body: HotelIn, db: DB, _: AdminUser) -> HotelOut:
    hotel = Hotel(**body.model_dump())
    db.add(hotel)
    db.commit()
    return HotelOut.model_validate(hotel)
```
Read it as: on `POST /api/hotels`, check the body is a valid `HotelIn`, give me a database session,
and only allow admins. Save the hotel and reply with it.

**The pieces:**
| File | What it does |
| --- | --- |
| `main.py` | creates the app, sets CORS (which websites may call it), adds the routers |
| `routers/*.py` | the endpoints, one file per area |
| `schemas.py` | Pydantic models: what comes in (`...In`) and goes out (`...Out`) |
| `deps.py` | **dependencies**: reusable "run this first" steps (`DB`, `StaffUser`, `AdminUser`) |
| `services.py` | the availability rule, shared by two endpoints |
| `config.py` | settings read from environment variables, never hard-coded secrets |

**Try it:** open <http://localhost:8000/docs>, click **Authorize**, sign in as staff, then try
`GET /api/stats` (works) and `POST /api/hotels` (403: staff can't).

### Check yourself
1. What is dependency injection, and how do the tests use it? (Functions declare what they need;
   FastAPI provides it. Tests swap the real database for a test one with `dependency_overrides`.)
2. What is CORS? (A browser rule: a page on site A may call site B's API only if B allows A.)

---

## Part 9. PostgreSQL, SQLAlchemy and Alembic

**In one sentence:** data lives in related tables; SQLAlchemy lets us describe them as Python classes,
and Alembic records every change to them.

**The tables** (`backend/app/models.py`):
```
Hotel 1──* RoomType 1──* RatePlan
              │
              └──* Booking *── User
```
One hotel has many room types; one room type has many rate plans and many bookings.

**Rules the database itself enforces**, even if the code had a bug:
- `stars BETWEEN 1 AND 5`, `check_out > check_in`, `price_per_night > 0`
- `role` must be `admin` or `staff`; `status` must be `confirmed` or `cancelled`
- deleting a hotel deletes its room types (`CASCADE`), but a room type with bookings can't be
  deleted (`RESTRICT`)

**Money uses `Numeric(10, 2)`**, which is exact. Never use floats for money (0.1 + 0.2 ≠ 0.3).

**The availability rule** (`services.py`). Two stays overlap when
`existing.check_in < new.check_out AND existing.check_out > new.check_in`.
Then we find the **busiest night**: each overlapping stay adds +1 room on its first night and −1 on
its check-out day; sort those events by date and keep a running total; the highest total wins.
Two short stays on different nights never need two rooms at once, so this is more accurate than
counting overlaps. The API also refuses ranges over 60 nights.

**The double-booking guard** (`create_booking`):
`select(RoomType)...with_for_update()` locks that room type's row until the booking is saved. A second
request for the same room type waits, then sees the first booking and gets "sold out".
We tested it with 10 simultaneous requests for one room: exactly 1 booking was created.

**Migrations:** `alembic/versions/0001_initial_tables.py` creates every table. Changing a table means
editing `models.py`, running `alembic revision --autogenerate -m "describe it"`, reading the generated
file, then `alembic upgrade head`.

**Try it:**
```bash
docker compose exec db psql -U hotels
SELECT guest_name, check_in, total_price FROM bookings ORDER BY total_price DESC LIMIT 5;
UPDATE hotels SET stars = 9 WHERE id = 1;     -- refused by the CHECK rule
\q
```

### Check yourself
1. What is a race condition, and how does the row lock prevent double-booking?
2. What is the "N+1 query" problem? (Loading a list in 1 query, then each item's related data in N
   more. We avoid it with `selectinload` and `joinedload`.)

---

## Part 10. Login, JWT and roles

**In one sentence:** the server checks your password once, then gives you a signed token that proves
who you are on every later request.

1. **Passwords are never stored**, only an Argon2 hash (a one-way scramble).
   `security.py`: `hash_password`, `verify_password`.
2. **Signing in** (`routers/auth.py`) checks the hash and returns a JWT containing your user id, role
   and an expiry time (8 hours). Wrong email and wrong password give the same message, so attackers
   can't tell which emails exist.
3. **Every request** sends `Authorization: Bearer <token>`. `deps.py` checks the signature, loads the
   user, and for admin-only endpoints checks the role (`require_admin`).
4. **In the browser** the token is stored in `localStorage` (`lib/api.ts`). A 401 response signs you
   out automatically.

### Check yourself
1. Why Argon2 instead of a fast hash like SHA-256? (Argon2 is deliberately slow and memory-hungry,
   so guessing millions of passwords is impractical.)
2. Where should a token be stored? (Trade-off: `localStorage` is simple but readable by injected
   scripts; an `HttpOnly` cookie isn't, but needs protection against cross-site requests.)
3. How do you "log out" a JWT before it expires? (You can't on its own; that's why it expires. For
   instant revocation you'd keep a deny-list or use short tokens with refresh tokens.)

---

## Part 11. Testing

**In one sentence:** tests are code that checks code, so you can change things without fear.

- **Back end** (`backend/tests/`, run `pytest`): each test gets a fresh in-memory database
  (`conftest.py`) and calls the API like a browser would. `test_bookings.py` reads like a list of
  business rules: prices the stay, can't double-book, back-to-back stays are fine, busiest night,
  cancelling frees the room, ranges are capped.
- **Front end** (`src/**/*.test.tsx`, run `npm test`): Vitest with React Testing Library. Tests act
  like a user ("type in the search box", "click Sign in") and fake the network with a mocked `fetch`.

**Try it:** write a backend test that an admin can't delete a rate plan that has bookings (expect 409).

### Check yourself
1. Unit vs integration vs end-to-end tests: which kind are our API tests? (Integration: real
   endpoints plus a real database.)

---

## Part 12. Docker and deployment

**In one sentence:** Docker packages each part with everything it needs, so it runs the same on any
machine.

| File | What it does |
| --- | --- |
| `backend/Dockerfile` | Python image → install requirements → copy code → run `start.sh` |
| `backend/start.sh` | apply migrations, load demo data if `SEED_DEMO=true`, start the server |
| `frontend/Dockerfile` | two stages: Node builds the app, then a tiny nginx image serves the files |
| `docker-compose.yml` | starts `db`, then `api` once the db is healthy, then `web` once the api is healthy |

**Online:**
- **Neon** hosts PostgreSQL.
- **Render** builds `backend/Dockerfile` and runs it. Settings come from environment variables
  (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `SEED_DEMO`), never from the code.
- **Vercel** builds the front end with `VITE_API_URL` pointing at Render. `vercel.json` sends every
  path to `index.html` so React Router can handle `/bookings` on a page refresh.
- Both redeploy automatically when you push to `main` on GitHub.

### Check yourself
1. Image vs container? (An image is the snapshot; a container is a running copy of it.)
2. Why is the first request to the live API sometimes slow? (Render's free plan sleeps when idle.)

---

## Part 13. Practice and interview prep

### Exercises (do them in order)

- [ ] **Easy:** add a "Created by" column to the bookings table. *(Part 6)*
- [ ] **Easy:** add a Profile page at `/profile`. *(Part 4)*
- [ ] **Medium:** add a backend test: a rate plan with bookings can't be deleted. *(Part 11)*
- [ ] **Medium:** add an optional `phone` field to bookings: model, migration, schema, form, table. *(Parts 9, 8, 7, 6)*
- [ ] **Medium:** add `GET /api/hotels/{id}/bookings-count` and show it on the hotel page. *(Parts 8, 5)*
- [ ] **Stretch:** make the dashboard's "Next arrivals" list filterable by hotel. *(Parts 5, 4)*

Each one touches the full stack. Finishing them is what turns "I've seen this code" into "I built this".

### The 30-second version

> "It's a hotel booking manager I built end to end. React and TypeScript on the front, with TanStack
> Query for server state, including optimistic updates, and TanStack Table for sortable, filterable
> grids. The API is FastAPI with PostgreSQL through SQLAlchemy and Alembic, with JWT sign-in and admin
> and staff roles, and it's covered by pytest and Vitest tests. The interesting part is availability:
> the server finds the busiest night of a stay and locks the room type while it books, so two people
> can't take the last room at the same moment. I tested that with ten simultaneous requests. It runs
> with one `docker compose up` and is deployed on Vercel, Render and Neon."

### Questions to practise out loud

1. Walk me through what happens when a user creates a booking. *(Part 2)*
2. How do you stop two users booking the last room? *(Part 9)*
3. How does authentication work, and how do you restrict admin actions? *(Part 10)*
4. What's an optimistic update, and how do you roll it back? *(Part 5)*
5. Why validate on both the client and the server? *(Part 7)*
6. How would you change the bookings table to handle a million rows? (Server-side filtering,
   sorting and pagination, plus database indexes on the filtered columns.)
7. What would you add next? (Payments, email confirmations, a calendar view, refresh tokens, audit
   logs.)

When you can answer these without notes and open any file to explain it, you're ready.
