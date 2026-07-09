
-- Roles enum + tabla separada (seguridad)
CREATE TYPE public.app_role AS ENUM ('admin', 'cliente');

-- Perfiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Trigger para crear profile + rol cliente por defecto al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Eventos
CREATE TABLE public.eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'General',
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  lugar TEXT NOT NULL,
  imagen_url TEXT,
  precio NUMERIC(10,2) NOT NULL DEFAULT 0,
  aforo_maximo INT NOT NULL DEFAULT 0,
  entradas_vendidas INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.eventos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eventos activos públicos" ON public.eventos FOR SELECT USING (activo = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins crean eventos" ON public.eventos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins editan eventos" ON public.eventos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins borran eventos" ON public.eventos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER eventos_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Compras
CREATE TABLE public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  cantidad_entradas INT NOT NULL CHECK (cantidad_entradas > 0),
  total_pagado NUMERIC(10,2) NOT NULL,
  codigo_qr TEXT NOT NULL UNIQUE DEFAULT ('ALB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  fecha_compra TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.compras TO authenticated;
GRANT ALL ON public.compras TO service_role;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus compras" ON public.compras FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Usuarios crean sus compras" ON public.compras FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger: incrementar entradas_vendidas al insertar compra (y validar aforo)
CREATE OR REPLACE FUNCTION public.registrar_compra()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disponible INT;
BEGIN
  SELECT (aforo_maximo - entradas_vendidas) INTO v_disponible FROM public.eventos WHERE id = NEW.evento_id FOR UPDATE;
  IF v_disponible IS NULL THEN RAISE EXCEPTION 'Evento no encontrado'; END IF;
  IF v_disponible < NEW.cantidad_entradas THEN RAISE EXCEPTION 'Aforo insuficiente'; END IF;
  UPDATE public.eventos SET entradas_vendidas = entradas_vendidas + NEW.cantidad_entradas WHERE id = NEW.evento_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER compras_after_insert AFTER INSERT ON public.compras FOR EACH ROW EXECUTE FUNCTION public.registrar_compra();

CREATE INDEX idx_compras_user ON public.compras(user_id);
CREATE INDEX idx_compras_evento ON public.compras(evento_id);
CREATE INDEX idx_eventos_fecha ON public.eventos(fecha);
