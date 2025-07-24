# Configuración de Supabase para Localhost

## Problema Identificado

Tienes dos problemas:

1. **Todos los favoritos aparecen marcados**: Esto era porque la función `isFavorite()` verificaba el DOM antes que la base de datos
2. **Localhost**: Supabase necesita tener localhost configurado en las URLs permitidas

## Solución para Localhost

### 1. Configurar URLs en Supabase

Ve a tu proyecto Supabase:

1. **Authentication** → **Settings**
2. En **Site URL**, asegúrate de que esté: `http://localhost:3000` (o el puerto que uses)
3. En **Redirect URLs**, agrega:
   ```
   http://localhost:3000
   http://localhost:3000/**
   ```

### 2. Verificar CORS

En **API Settings**, verifica que las URLs de localhost estén permitidas.

## Solución Temporal (Para probar rápidamente)

Ejecuta este SQL en Supabase para desactivar RLS temporalmente:

```sql
-- SOLO PARA PRUEBAS - Desactivar RLS temporalmente
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;
```

Esto te permitirá probar si los favoritos funcionan sin las políticas RLS. Si funcionan, entonces sabemos que el problema son las políticas.

## Después de la Prueba

Si funciona sin RLS, ejecuta este SQL para reactivarlo con políticas mejoradas:

```sql
-- Reactivar RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Política simple y directa
CREATE POLICY "allow_all_authenticated_users" ON public.favorites
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

## Código Corregido

Ya corregí la función `isFavorite()` para que:
- No verifique el DOM primero
- Siempre consulte la base de datos
- Retorne `false` en caso de error (no favorito por defecto)

## Pasos para Solucionar:

1. **Configura las URLs en Supabase** (arriba)
2. **Ejecuta el SQL temporal** para desactivar RLS
3. **Prueba los favoritos** - deberían funcionar
4. **Si funcionan**, ejecuta el SQL final para reactivar RLS con política simple
5. **Refresca tu aplicación**

¿Funciona ahora con estos cambios?
