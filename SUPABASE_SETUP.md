# Configuración de Supabase para ATV

## Pasos para configurar Supabase

### 1. Crear un proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Haz clic en "New Project"
4. Configura tu proyecto:
   - Nombre del proyecto: `ATV` (o el que prefieras)
   - Contraseña de la base de datos: (guárdala, la necesitarás)
   - Región: Elige la más cercana a tus usuarios

### 2. Configurar las variables de entorno

1. En tu proyecto de Supabase, ve a `Settings > API`
2. Copia los siguientes valores:
   - `Project URL` 
   - `anon public` key

3. Abre el archivo `supabase-config.js` y reemplaza:
   ```javascript
   const SUPABASE_URL = 'TU_SUPABASE_URL'; // Reemplaza con tu Project URL
   const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY'; // Reemplaza con tu anon key
   ```

### 3. Crear las tablas en la base de datos

1. En tu proyecto Supabase, ve a `SQL Editor`
2. Copia y pega el contenido del archivo `supabase-schema.sql`
3. Ejecuta el script haciendo clic en "Run"

### 4. Configurar autenticación

1. Ve a `Authentication > Settings`
2. En "Site URL", agrega tu dominio (ej: `http://localhost:3000` para desarrollo)
3. En "Redirect URLs", agrega también tu dominio
4. Opcionalmente, configura proveedores sociales (Google, GitHub, etc.)

### 5. Configurar políticas de seguridad (RLS)

Las políticas ya están incluidas en el script SQL, pero puedes verificarlas en:
- `Authentication > Policies`

### 6. Verificar la configuración

Una vez completados los pasos anteriores:

1. Reinicia tu servidor: `npm start`
2. Ve a tu aplicación
3. Intenta registrarte con un email
4. Verifica que puedes iniciar sesión
5. Prueba agregar/quitar favoritos

## Funcionalidades implementadas

### Autenticación
- ✅ Registro de usuarios con email/contraseña
- ✅ Inicio de sesión
- ✅ Cierre de sesión
- ✅ Persistencia de sesión
- ✅ Validación de contraseñas

### Gestión de favoritos
- ✅ Agregar películas/series a favoritos
- ✅ Quitar de favoritos
- ✅ Filtrar solo favoritos
- ✅ Sincronización en tiempo real
- ✅ Persistencia en la base de datos

### Interfaz
- ✅ Modal de login/registro responsivo
- ✅ Notificaciones de estado
- ✅ Indicadores visuales de autenticación
- ✅ Transiciones suaves

## Estructura de la base de datos

### Tabla `favorites`
- `id`: Identificador único
- `user_id`: ID del usuario (referencia a auth.users)
- `movie_title`: Título de la película/serie
- `movie_data`: Datos completos en formato JSON
- `created_at`: Fecha de creación

### Tabla `user_preferences` (opcional)
- `id`: Identificador único
- `user_id`: ID del usuario
- `preferences`: Preferencias en formato JSON
- `created_at`, `updated_at`: Timestamps

## Troubleshooting

### Error: "Invalid API key"
- Verifica que hayas copiado correctamente la anon key
- Asegúrate de no tener espacios extra

### Error: "Database connection failed"
- Verifica la URL del proyecto
- Asegúrate de que el proyecto esté activo en Supabase

### Los favoritos no se guardan
- Verifica que las políticas RLS estén configuradas
- Revisa la consola del navegador para errores
- Asegúrate de estar autenticado

### Emails de confirmación no llegan
- Verifica la configuración SMTP en Supabase
- Para desarrollo, puedes deshabilitar la confirmación de email

## Próximos pasos

1. **Configurar SMTP personalizado** para emails de producción
2. **Agregar autenticación social** (Google, GitHub, etc.)
3. **Implementar recuperación de contraseña**
4. **Agregar más campos al perfil de usuario**
5. **Implementar notificaciones push**

## Soporte

Si tienes problemas con la configuración:
1. Revisa la documentación oficial: [docs.supabase.com](https://docs.supabase.com)
2. Verifica la consola del navegador para errores
3. Revisa los logs en Supabase Dashboard
