-- Slots are replaced wholesale by POST /reset.
-- start_raw/end_raw keep the exact strings the client sent so responses echo them
-- unchanged; start_at/end_at are the parsed values used for ordering and time checks.
CREATE TABLE slots (
  id        text PRIMARY KEY,
  provider  text        NOT NULL,
  start_raw text        NOT NULL,
  end_raw   text        NOT NULL,
  start_at  timestamptz NOT NULL,
  end_at    timestamptz NOT NULL
);

CREATE INDEX slots_start_idx ON slots (start_at, id);
CREATE INDEX slots_provider_idx ON slots (provider, start_at, id);

-- seq gives a stable, monotonic order for keyset pagination ("oldest first").
CREATE TABLE bookings (
  seq        bigserial   PRIMARY KEY,
  id         uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  slot_id    text        NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  email      text        NOT NULL,
  status     text        NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_email_seq_idx ON bookings (email, seq);

-- The double-booking guarantee: at most one confirmed booking per slot,
-- enforced by the database no matter how many requests race.
CREATE UNIQUE INDEX bookings_one_confirmed_per_slot
  ON bookings (slot_id) WHERE status = 'confirmed';

-- Stored outcomes of POST /bookings requests that carried an Idempotency-Key.
CREATE TABLE idempotency_keys (
  key          text        PRIMARY KEY,
  request_hash text        NOT NULL,
  status       integer     NOT NULL,
  body         jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per POST /bookings attempt, for the per-email sliding-window rate limit.
CREATE TABLE booking_attempts (
  id    bigserial   PRIMARY KEY,
  email text        NOT NULL,
  at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_attempts_email_at_idx ON booking_attempts (email, at);
