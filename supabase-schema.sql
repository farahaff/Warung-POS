create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  price integer not null check (price >= 0),
  cost integer not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock integer not null default 5 check (low_stock >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,
  total integer not null check (total >= 0),
  cost_total integer not null check (cost_total >= 0),
  profit integer not null,
  payment_method text not null check (payment_method in ('Cash', 'QRIS', 'Transfer', 'Card')),
  cash integer not null default 0 check (cash >= 0),
  change integer not null default 0 check (change >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  category text not null,
  price integer not null check (price >= 0),
  cost integer not null check (cost >= 0),
  quantity integer not null check (quantity > 0),
  subtotal integer not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index if not exists products_user_id_name_idx on public.products(user_id, name);
create index if not exists sales_user_id_created_at_idx on public.sales(user_id, created_at desc);
create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

drop policy if exists "products_select_own" on public.products;
drop policy if exists "products_insert_own" on public.products;
drop policy if exists "products_update_own" on public.products;
drop policy if exists "products_delete_own" on public.products;

create policy "products_select_own" on public.products for select using (auth.uid() = user_id);
create policy "products_insert_own" on public.products for insert with check (auth.uid() = user_id);
create policy "products_update_own" on public.products for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "products_delete_own" on public.products for delete using (auth.uid() = user_id);

drop policy if exists "sales_select_own" on public.sales;
drop policy if exists "sales_insert_own" on public.sales;

create policy "sales_select_own" on public.sales for select using (auth.uid() = user_id);
create policy "sales_insert_own" on public.sales for insert with check (auth.uid() = user_id);

drop policy if exists "sale_items_select_own" on public.sale_items;
drop policy if exists "sale_items_insert_own" on public.sale_items;

create policy "sale_items_select_own" on public.sale_items for select using (auth.uid() = user_id);
create policy "sale_items_insert_own" on public.sale_items for insert with check (auth.uid() = user_id);
