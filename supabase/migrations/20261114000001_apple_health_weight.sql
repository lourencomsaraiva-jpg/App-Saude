-- Peso vindo da app Saúde do iPhone (balança → Saúde → Atalho → /api/peso)
alter table public.days drop constraint if exists days_weight_source_check;
alter table public.days add constraint days_weight_source_check check (weight_source in ('intervals','fit','manual','seed','apple_health'));
