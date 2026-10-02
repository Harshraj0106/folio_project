create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  symbol text not null,
  exchange text not null check (exchange in ('NSE', 'BSE')),
  sector text not null check (char_length(sector) between 1 and 40),
  purchase_price numeric(14, 2) not null check (purchase_price > 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  constraint holdings_symbol_format check (
    (exchange = 'NSE' and symbol ~ '^[A-Z0-9&-]{1,20}$')
    or (exchange = 'BSE' and symbol ~ '^[0-9]{6}$')
  ),
  constraint holdings_one_per_stock unique (user_id, exchange, symbol)
);

alter table public.holdings enable row level security;

revoke all on public.holdings from anon;
grant select, insert, update, delete on public.holdings to authenticated;

create policy "Users can read their own holdings"
  on public.holdings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own holdings"
  on public.holdings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can edit their own holdings"
  on public.holdings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own holdings"
  on public.holdings for delete to authenticated
  using ((select auth.uid()) = user_id);
