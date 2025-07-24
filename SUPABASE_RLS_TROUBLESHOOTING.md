# Solución para Errores RLS en Supabase - Favoritos

## Problema
Error 403 (Forbidden) con código `42501`: "permission denied for table favorites"

## Causa
Las políticas de Row Level Security (RLS) no están configuradas correctamente en Supabase.

## Solución

### Paso 1: Verificar el Estado Actual
Abre la consola del navegador y ejecuta:
```javascript
debugSupabaseAuth()
```

Esto te mostrará:
- Si el usuario está autenticado
- Si puede acceder a la tabla favorites
- Detalles específicos del error

### Paso 2: Ver el SQL Necesario
En la consola del navegador, ejecuta:
```javascript
debugSupabaseRLS()
```

Esto te mostrará el SQL completo que necesitas ejecutar.

### Paso 3: Ejecutar el Script SQL en Supabase

1. Ve a tu proyecto Supabase
2. Navega a **SQL Editor**
3. Crea una nueva consulta
4. Copia y pega el contenido del archivo `supabase-rls-fix.sql`
5. Ejecuta el script haciendo clic en **Run**

### Paso 4: Verificar la Configuración

El script incluye consultas de verificación que te mostrarán:
- Las políticas creadas
- La estructura de la tabla
- Si RLS está habilitado

### Paso 5: Probar la Funcionalidad

1. Recarga tu aplicación
2. Inicia sesión con tu usuario
3. Intenta agregar/quitar favoritos
4. Revisa la consola para ver los logs detallados

## Comandos de Debug Disponibles

### `debugSupabaseAuth()`
Verifica el estado de autenticación y acceso a la tabla.

### `debugSupabaseRLS()`
Muestra el SQL necesario para configurar las políticas RLS.

## Script SQL Completo (supabase-rls-fix.sql)

El archivo `supabase-rls-fix.sql` contiene:
1. Eliminación de políticas existentes
2. Creación/verificación de la tabla favorites
3. Habilitación de RLS
4. Creación de políticas corregidas
5. Índices de rendimiento
6. Consultas de verificación

## Notas Importantes

- **Autenticación Requerida**: El usuario debe estar autenticado para usar favoritos
- **Verificación de Usuario**: Se verifica que el usuario autenticado coincida con el solicitado
- **Logs Detallados**: Ahora hay logs más informativos en la consola
- **Manejo de Errores**: Mejor identificación de errores RLS vs otros errores

## Si el Problema Persiste

1. Verifica que las variables de entorno estén configuradas:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

2. Confirma que el usuario esté autenticado correctamente

3. Revisa los logs de la consola para errores específicos

4. Verifica en Supabase Dashboard → Authentication → Policies que las políticas estén activas
