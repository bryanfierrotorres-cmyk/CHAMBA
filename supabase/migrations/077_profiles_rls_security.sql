-- Clientes solo leen su propio perfil
create policy "clients can read own profile"
on profiles for select
using (auth.uid() = id);

-- Técnicos no pueden leer perfiles administradores ajenos
create policy "workers cannot access admin data"
on profiles for select
using (
  role != 'admin'
  or auth.uid() = id
);
