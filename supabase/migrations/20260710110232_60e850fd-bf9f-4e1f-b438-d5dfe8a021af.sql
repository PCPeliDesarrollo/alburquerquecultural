
-- 1) Añadir apellidos a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apellidos TEXT;

-- 2) Actualizar handle_new_user para guardar apellidos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, apellidos)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'apellidos'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cliente');
  RETURN NEW;
END;
$function$;

-- 3) Tabla entradas (una fila por entrada individual)
CREATE TABLE IF NOT EXISTS public.entradas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  codigo_qr TEXT NOT NULL UNIQUE DEFAULT ('ALB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  usada BOOLEAN NOT NULL DEFAULT false,
  fecha_uso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entradas_compra ON public.entradas(compra_id);
CREATE INDEX IF NOT EXISTS idx_entradas_user ON public.entradas(user_id);
CREATE INDEX IF NOT EXISTS idx_entradas_evento ON public.entradas(evento_id);

GRANT SELECT, UPDATE ON public.entradas TO authenticated;
GRANT ALL ON public.entradas TO service_role;

ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus entradas"
  ON public.entradas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Solo admins pueden marcarlas como usadas
CREATE POLICY "Admins actualizan entradas"
  ON public.entradas FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4) Trigger: al insertar una compra, crear N entradas
CREATE OR REPLACE FUNCTION public.generar_entradas_compra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..NEW.cantidad_entradas LOOP
    INSERT INTO public.entradas (compra_id, evento_id, user_id)
    VALUES (NEW.id, NEW.evento_id, NEW.user_id);
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_generar_entradas ON public.compras;
CREATE TRIGGER trg_generar_entradas
  AFTER INSERT ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION public.generar_entradas_compra();

-- 5) Rellenar entradas para compras existentes (backfill)
INSERT INTO public.entradas (compra_id, evento_id, user_id, codigo_qr)
SELECT c.id, c.evento_id, c.user_id,
       CASE WHEN gs.n = 1 THEN c.codigo_qr
            ELSE 'ALB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
       END
FROM public.compras c
CROSS JOIN LATERAL generate_series(1, c.cantidad_entradas) AS gs(n)
WHERE NOT EXISTS (SELECT 1 FROM public.entradas e WHERE e.compra_id = c.id);
