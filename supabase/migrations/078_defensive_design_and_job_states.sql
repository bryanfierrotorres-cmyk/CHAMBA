create or replace function public.update_job_status(
  job_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
as $$
declare 
  current_status text;
begin
  select status into current_status from jobs where id = job_id;

  if current_status is null then
    raise exception 'El trabajo especificado no existe';
  end if;

  -- Bloqueo de estados terminales inmutables
  if current_status in ('completed', 'rejected') then
    raise exception 'Operación denegada: El trabajo ya se encuentra en un estado terminal (%)', current_status;
  end if;

  -- Matriz estricta y secuencial de transiciones legales
  if (current_status = 'pending' and new_status not in ('assigned', 'rejected')) or
     (current_status = 'assigned' and new_status not in ('arrived', 'rejected')) or
     (current_status = 'arrived' and new_status not in ('in_progress')) or
     (current_status = 'in_progress' and new_status not in ('completed')) then
    raise exception 'Transición inválida e ilegal de estados en el sistema: % -> %', current_status, new_status;
  end if;

  update jobs set status = new_status where id = job_id;
end;
$$;

create table if not exists public.job_rejections (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  worker_id uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(job_id, worker_id)
);

alter table public.job_rejections enable row level security;

create policy "Workers can insert their own rejections"
on job_rejections for insert
with check (auth.uid() = worker_id);

create policy "Workers can read their own rejections"
on job_rejections for select
using (auth.uid() = worker_id);

create or replace function public.is_admin(user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
end;
$$;

create policy "only admins can update verification"
on profiles for update
using ( public.is_admin(auth.uid()) );
