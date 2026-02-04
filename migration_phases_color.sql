-- Add color column to phases table
alter table public.phases 
add column color text;

-- (Optional) Update existing phases to inherit cycle color (if needed, but probably empty now)
-- update public.phases p
-- set color = c.color
-- from public.cycles c
-- where p.cycle_id = c.id;
