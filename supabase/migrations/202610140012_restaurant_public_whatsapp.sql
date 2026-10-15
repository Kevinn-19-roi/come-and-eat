-- Explicit consent for public click-to-chat. The operational number stays available
-- to authorized order handlers; no owner profile contact is copied here.
alter table public.restaurants
  add column whatsapp_public boolean not null default false;
comment on column public.restaurants.whatsapp_public is
  'Restaurant authorizes a public WhatsApp button using its professional WhatsApp number.';
