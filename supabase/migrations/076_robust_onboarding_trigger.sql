create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    now()
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning 'Profile creation failed for user %', new.id;
    return new;
end;
$$;
