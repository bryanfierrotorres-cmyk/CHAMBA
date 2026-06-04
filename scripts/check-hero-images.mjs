const ids = {
  'hogar-promo-segundo-servicio': 'photo-1607083206869-657c2be12242',
  'hogar-limpieza': 'photo-1581578731548-c64695cc6952',
  'hogar-mantenimiento': 'photo-1621905251189-08b45d6a269e',
  'hogar-vida': 'photo-1416879595882-3373a0480b5b',
  'empresa-operativo': 'photo-1586528116311-ad8dd3c8310d',
  'empresa-limpieza': 'photo-1484154218962-d7a5be0594ef',
  'empresa-eventos': 'photo-1555241047-59235a8f7a43',
};

for (const [k, id] of Object.entries(ids)) {
  const u = `https://images.unsplash.com/${id}?w=400&q=80`;
  fetch(u, { method: 'HEAD', redirect: 'follow' })
    .then((r) => console.log(k, r.status))
    .catch((e) => console.log(k, 'ERR', e.message));
}
