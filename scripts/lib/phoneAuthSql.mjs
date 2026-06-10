/** Columnas token en auth.users deben ser '' no NULL (GoTrue login). */
export const AUTH_TOKEN_COLUMNS = [
  'confirmation_token',
  'recovery_token',
  'email_change_token_new',
  'email_change',
  'email_change_token_current',
  'phone_change_token',
  'reauthentication_token',
];

export const patchAuthUserTokenColumns = async (db, userId) => {
  const sets = AUTH_TOKEN_COLUMNS.map((c) => `${c} = COALESCE(${c}, '')`).join(', ');
  await db.query(`UPDATE auth.users SET ${sets} WHERE id = $1::uuid`, [userId]);
};

export const patchAllAuthUserTokenColumns = async (db) => {
  const sets = AUTH_TOKEN_COLUMNS.map((c) => `${c} = COALESCE(${c}, '')`).join(', ');
  await db.query(`UPDATE auth.users SET ${sets} WHERE ${AUTH_TOKEN_COLUMNS.map((c) => `${c} IS NULL`).join(' OR ')}`);
};

export const insertPhoneAuthUser = async (db, { userId, email, password, fullName, role }) => {
  await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await db.query(`DELETE FROM auth.identities WHERE user_id = $1::uuid`, [userId]);
  await db.query(`DELETE FROM auth.users WHERE id = $1::uuid`, [userId]);

  const tokenCols = AUTH_TOKEN_COLUMNS.join(', ');
  const tokenVals = AUTH_TOKEN_COLUMNS.map(() => "''").join(', ');

  await db.query(
    `
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      ${tokenCols},
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      $1::uuid,
      'authenticated',
      'authenticated',
      $2,
      crypt($3, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      $4::jsonb,
      ${tokenVals},
      NOW(),
      NOW()
    )
    `,
    [userId, email, password, JSON.stringify({ full_name: fullName, role })],
  );

  const { rows: idRows } = await db.query(`SELECT gen_random_uuid() AS identity_id`);
  const identityId = idRows[0].identity_id;

  await db.query(
    `
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::jsonb,
      'email',
      $4,
      NOW(),
      NOW(),
      NOW()
    )
    `,
    [identityId, userId, JSON.stringify({ sub: userId, email }), email],
  );

  await patchAuthUserTokenColumns(db, userId);
};
