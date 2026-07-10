
-- Create two admin users with password 010101
DO $$
DECLARE
  v_user_id uuid;
  v_emails text[] := ARRAY['gerenciapcpeli@gmail.com', 'jesusmartin@gmail.com'];
  v_email text;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
        email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        v_email, crypt('010101', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nombre', split_part(v_email,'@',1), 'apellidos', 'Admin'),
        false, '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email), 'email', v_user_id::text, now(), now(), now());
    ELSE
      UPDATE auth.users SET encrypted_password = crypt('010101', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now()
      WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (id, email, nombre, apellidos)
    VALUES (v_user_id, v_email, split_part(v_email,'@',1), 'Admin')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;
