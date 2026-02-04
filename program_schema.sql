-- Programs table
create table public.programs (
  id uuid not null default gen_random_uuid() primary key,
  title text not null,
  start_date date not null, -- The Monday when the program starts
  is_active boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Cycles (e.g., "Build Phase", "Peak Phase")
create table public.cycles (
  id uuid not null default gen_random_uuid() primary key,
  program_id uuid references public.programs(id) on delete cascade not null,
  title text not null,
  color text, -- For UI coloring
  order_index integer not null, -- 1, 2, 3...
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Phases (Replaces "Weeks", inside a Cycle)
create table public.phases (
  id uuid not null default gen_random_uuid() primary key,
  cycle_id uuid references public.cycles(id) on delete cascade not null,
  title text not null, -- e.g. "Phase 1: Intro"
  order_index integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Workouts (Specific training days within a Phase)
create table public.workouts (
  id uuid not null default gen_random_uuid() primary key,
  phase_id uuid references public.phases(id) on delete cascade not null,
  title text not null, -- e.g. "Workout 1"
  order_index integer not null, -- 1, 2, 3, 4
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Workout Blocks (Groups of exercises, e.g. "15 min AMRAP")
create table public.workout_blocks (
  id uuid not null default gen_random_uuid() primary key,
  workout_id uuid references public.workouts(id) on delete cascade not null,
  title text, -- e.g. "15 мин"
  order_index integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Block Rows (Individual exercise lines, e.g. "A1 Run 10 min")
create table public.block_rows (
  id uuid not null default gen_random_uuid() primary key,
  block_id uuid references public.workout_blocks(id) on delete cascade not null,
  prefix text, -- e.g. "A1", "Б2"
  content text not null, -- Exercise description
  order_index integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.programs enable row level security;
alter table public.cycles enable row level security;
alter table public.phases enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.block_rows enable row level security;

-- Policies

-- Public Read Access based on roles checks manually in UI, 
-- but technically anyone can read the program (Guest access allowed)
create policy "Allow public read access programs" on public.programs for select using (true);
create policy "Allow public read access cycles" on public.cycles for select using (true);
create policy "Allow public read access phases" on public.phases for select using (true);
create policy "Allow public read access workouts" on public.workouts for select using (true);
create policy "Allow public read access blocks" on public.workout_blocks for select using (true);
create policy "Allow public read access rows" on public.block_rows for select using (true);

-- Admin Write Access
-- Helper function to check if user is admin
-- (Assuming profiles table has id matching auth.uid() and role 'admin')
-- Note: This depends on existing 'profiles' table from Supabase integration

create policy "Allow admin full access programs" on public.programs for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Allow admin full access cycles" on public.cycles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Allow admin full access phases" on public.phases for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Allow admin full access workouts" on public.workouts for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Allow admin full access blocks" on public.workout_blocks for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Allow admin full access rows" on public.block_rows for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
