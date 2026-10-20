-- Coordonnées laissées volontairement par les personnes intéressées par Julia (formulaire facultatif,
-- avec consentement explicite). Ce n'est pas un compte : aucune authentification n'en dépend.
CREATE TABLE contacts (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name    text NOT NULL,
    email        text NOT NULL,
    phone        text,
    company      text,
    position     text,
    consent      boolean NOT NULL CHECK (consent),
    client_hash  text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contacts_created_at_idx ON contacts (created_at);
