-- 1. Enable RLS on all tables (idempotent)
alter table public.programs enable row level security;
alter table public.cycles enable row level security;
alter table public.phases enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
alter table public.block_rows enable row level security;

-- 2. Drop existing policies to avoid duplicates
drop policy if exists "Allow public read access programs" on public.programs;
drop policy if exists "Allow public read access cycles" on public.cycles;
drop policy if exists "Allow public read access phases" on public.phases;
drop policy if exists "Allow public read access workouts" on public.workouts;
drop policy if exists "Allow public read access blocks" on public.workout_blocks;
drop policy if exists "Allow public read access rows" on public.block_rows;

-- 3. Re-create Public Read Policies (Allow everyone to VIEW)
create policy "Allow public read access programs" on public.programs for select using (true);
create policy "Allow public read access cycles" on public.cycles for select using (true);
create policy "Allow public read access phases" on public.phases for select using (true);
create policy "Allow public read access workouts" on public.workouts for select using (true);
create policy "Allow public read access blocks" on public.workout_blocks for select using (true);
create policy "Allow public read access rows" on public.block_rows for select using (true);

-- 4. Check if Admin policies need creation (Optional, if you are Admin you usually have them)
-- But ensuring Public Read is critical for the Main Page content.
