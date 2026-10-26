-- Migration 0016: Agent email optional
--
-- Field agents have no portal login — their reconciliations are delivered via
-- WhatsApp/email, so an address is no longer mandatory on the agents profile.
-- Staff logins (profiles.email) still require an address.

alter table public.agents alter column email drop not null;
