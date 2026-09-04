# TAMAM Chalet — تمام شاليه

Hourly chalet booking. Not a listing marketplace: the platform's job is to keep
one calendar correct and to help an owner sell the hours that would otherwise
sit empty.

The module is its own domain rather than another job type. A chalet booking is
a window of time on one property — nothing about dispatch, partner assignment,
offers or live tracking applies to it. It reuses the platform's shared services
(payments, notifications, media, zones, audit) and shares nothing else.

## The guarantees

Everything below is enforced, and each has a test in
`apps/api/test/chalet-acceptance.e2e-spec.ts` named after it.

### 1. The same slot cannot be sold twice

Not "is unlikely to be", **cannot**. The guarantee lives in PostgreSQL:

```sql
EXCLUDE USING gist (
  chalet_id WITH =,
  tstzrange(start_at, blocked_until, '[)') WITH &&
) WHERE (status IN ('HELD','AWAITING_PAYMENT','CONFIRMED', …))
```

Two customers pressing confirm in the same millisecond both pass the
availability check — that check is advisory by design. One of them loses at the
write and gets *"someone just booked this slot"*.

Application code cannot win that race on its own, so it does not try. Every
write that touches a calendar is a transaction ending in a write the database
can reject.

### 2. Cleaning time belongs to the chalet, not the next guest

A booking occupies `[startAt, endAt + cleaningDurationMinutes)`. `blocked_until`
carries that right edge and is **derived by a database trigger**, not trusted
from the application, so no code path can write a booking that quietly forgets
its buffer.

Booked 12:00–16:00 with 90 minutes of cleaning: 16:00 is refused, 17:15 is
refused, 17:30 is accepted.

Two constraints that look alike and are not:

- the **booking** must end by closing time;
- the **booking plus its cleaning** must stay clear of the calendar.

So cleaning may run past closing — that is the staff's time, not a customer's —
and 21:00–23:00 stays bookable on a chalet that cleans for ninety minutes.

### 3. A hold protects checkout, then releases the slot

Creating a booking takes a hold, it does not confirm. The slot is occupied for
`holdDurationMinutes` (7 by default) so nobody can take it mid-payment.

A lapsed hold is released at the start of **every write that touches the
chalet**, not only by the scheduled sweep — so correctness never depends on how
often that runs. The sweep exists as well, every minute, because seven minutes
is the whole window.

The hold is re-read inside the transaction at confirmation: seven minutes is
long enough to lapse, and confirming an expired hold would hand out a slot the
calendar has already re-offered.

### 4. Availability tells the truth about what is bookable

The engine is pure — no clock, no database, no timezone guessing beyond the one
it is handed. It returns windows already clear of bookings, blocks and cleaning
buffers, so the app never subtracts anything itself.

Opening hours resolve **through the chalet's timezone** rather than by
arithmetic, so a chalet open 08:00–23:00 is open fifteen hours on the day the
clocks change. The booking grid is anchored to opening time rather than to the
hour, or a chalet opening at 08:20 could never be booked at 08:20.

A failed slot check explains itself — inside another booking's cleaning window,
outside opening hours, off the grid — and offers alternatives.

### 5. An owner block is as real as a booking

Owner blocks and maintenance windows have their own exclusion constraint, so an
owner who blocks the same afternoon twice gets one row rather than two.

### 6. The TAMAM calendar is the only calendar

An owner records a booking taken over the phone or on another site through
`POST owner/chalets/:id/bookings/external`. It has no TAMAM customer, never goes
through payment, and is confirmed on arrival — but it occupies the calendar
exactly like any other booking, cleaning buffer included, under the same
exclusion constraint.

Without this an owner would be double-booked by their own two channels and would
learn to distrust the calendar, which is the one thing the product cannot
afford.

### 7. The price never goes below what the owner set

Smart Pricing is a set of rules an owner can read, not a model. It applies their
own rate rules, measures how full their calendar is against **their own**
occupancy target, and reports every step in words.

`minimumHourlyRate` is a hard floor, applied last and unconditionally. The
owner's own `maxAutoDiscountPercent` binds before it. A test walks four pricing
profiles × five occupancy levels × five lead times × both gap states with a 50%
offer on top — 200 combinations, never once below the floor.

Rate rules do **not** compound: the highest-priority match wins outright, so an
owner who writes "Thursdays +30%" and "evenings +20%" gets a Thursday evening at
thirty percent more, not fifty-six.

Booking length is charged as booked. 90 minutes is an hour and a half, because a
chalet sold by the hour that rounds up to two is not sold by the hour.

#### No fake AI

The spec is explicit and so is the code: rule-based pricing is never dressed up
as intelligence. It is called **Smart Pricing**, never "AI optimised". An owner
told *"the AI decided"* has no way to argue with a number they should be able to
change; an owner told *"your week is 30% booked against a target of 80%"* can.

`apps/api/src/modules/chalet/domain/no-fake-ai.spec.ts` reads the module's own
source and fails the build if a user-facing string claims otherwise, in Arabic
or English.

### 8. A confirmed price is history

The full breakdown is written onto the booking at confirmation, and a database
trigger refuses to let it change afterwards. An owner may reprice their chalet
whenever they like and delete a rate rule the day after; a receipt can still be
explained months later from the booking alone.

### 9. Extending is allowed only when the time is actually free

The booking is excluded from its own availability check — it would otherwise
always collide with itself — and only the added time is repriced. What the
customer already agreed to pay does not move. The cleaning window moves with the
new end.

### 10. A guest who overstays is charged, not evicted

Overstay is charged rather than forbidden, because the alternative is a
confrontation at the gate. Fifteen minutes of grace means nobody is billed for
being slow packing the car.

Past the grace, the **whole** overrun is billed, not just the excess, at a
premium. That is deliberate: the chalet really was occupied for all of it, and
the next guest is kept waiting by all of it. The cliff at the grace boundary is
what makes the grace a courtesy rather than an entitlement.

The overstay fee is added to the total; it never touches the pricing snapshot,
which records what was agreed before the stay.

### 11. Empty gaps are found and offered

An owner does not need to be told their evenings are free — they can see that.
What they cannot see is the three-hour hole between a morning booking and an
evening one, too short to sell at full price and worth nothing empty.

An offer never advertises below the floor, and when the floor bites the
advertised discount is **restated to match what is actually charged**: promising
25% off and charging 10% at checkout is worse than promising 10% honestly.

An offer is retired the moment its slot is taken. A discount that fails at the
last step teaches customers to ignore the list.

### 12. The owner can see whether the chalet is earning

Occupancy counts booked minutes against **bookable** ones — the chalet's own
opening hours — so a chalet that closes overnight is not reported as a third
empty and permanently discounted for it.

Cancellations are counted separately rather than dropped: an owner losing a
quarter of their bookings needs to see that, and it is invisible in an occupancy
percentage.

The by-weekday and by-hour breakdowns are what make the number actionable. "60%
booked" tells an owner little; "your Sunday mornings are always empty" tells
them what to discount.

## Where things live

| Concern | Path |
| --- | --- |
| Models, enums | `apps/api/prisma/schema.prisma` (`chalet_*` tables) |
| Constraints, triggers | `apps/api/prisma/sql/002_chalet.sql` |
| Availability engine (pure) | `apps/api/src/modules/chalet/domain/availability.ts` |
| Smart Pricing (pure) | `apps/api/src/modules/chalet/domain/smart-pricing.ts` |
| Gap filler (pure) | `apps/api/src/modules/chalet/domain/gap-filler.ts` |
| Lifecycle, overstay (pure) | `apps/api/src/modules/chalet/domain/booking-state.ts` |
| Services | `apps/api/src/modules/chalet/chalet-*.service.ts` |
| HTTP | `chalet.controller.ts` (customer), `chalet-owner.controller.ts` (owner) |
| Contracts | `packages/shared-types` (enums, DTOs), `packages/validation/src/chalet.ts` |
| Acceptance tests | `apps/api/test/chalet-acceptance.e2e-spec.ts` |

The domain files are pure functions with no clock and no database, so the rules
can be read and tested without standing anything up. The services do the reading
and writing and nothing else.

## Scheduled work

The chalet sweeps ride on the existing maintenance scheduler rather than growing
a second one — that scheduler already guarantees N API replicas firing the same
tick produce exactly one queued job, and a duplicated hold-expiry sweep is not
something to find out about later.

| Cadence | Job |
| --- | --- |
| every minute | `chalet-expire-holds` |
| every 10 minutes | `chalet-retire-offers` |
| hourly | `chalet-generate-offers` (today and tomorrow) |

## Money and time

Money is integer minor units end to end, `BIGINT` in PostgreSQL and `bigint` in
TypeScript, rendered to the wire as a number by the global serializer. No floats
anywhere.

Instants are `timestamptz` and must land on a **whole minute** — seconds are
rejected, not truncated. Silently moving a booking by up to 59 seconds is how a
slot ends up half a minute off its own grid.

Durations are whole minutes. Opening hours are local `HH:mm` strings resolved
through the chalet's timezone.

## Still to build

- The Flutter booking journey (customer app) and owner dashboard, Arabic-first
  RTL.
- Admin approval screens for new chalets in `apps/admin-web`.
- Chalet search by zone and map, which the schema and validation already
  describe but no controller yet serves.
