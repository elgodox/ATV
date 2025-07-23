# Configuración de Supabase - Guía de Setup

## Problemas corregidos ✅

1. **Error en `supabase-config.js`**: Se corrigió el acceso incorrecto a `process.env.supabase`
2. **Variables de entorno en frontend**: Se implementó un sistema para servir las variables desde el servidor
3. **Cliente de Supabase**: Se restructuró para cargar la configuración dinámicamente
4. **Referencias en `database.js`**: Se actualizaron todas las llamadas para usar `supabase.client`

## Pasos para completar la configuración

### 1. Crear archivo `.env`
Copia el archivo `.env.example` a `.env` y completa con tus credenciales:

```bash
# Copiar archivo de ejemplo
copy .env.example .env
```

### 2. Obtener credenciales de Supabase
1. Ve a [https://supabase.com](https://supabase.com)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a Settings > API
4. Copia los valores de:
   - **Project URL** (SUPABASE_URL)
   - **Project API keys - anon public** (SUPABASE_ANON_KEY)

### 3. Configurar el archivo `.env`
Edita el archivo `.env` con tus valores reales:

```env
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto-id.supabase.co
SUPABASE_ANON_KEY=tu-clave-anon-aqui

# Otras variables existentes
API_KEY=tu-tmdb-api-key
VIMEO_ACCESS_TOKEN=tu-vimeo-token
OPENSUBTITLES_API_KEY=tu-opensubtitles-key
```

### 4. Configurar la base de datos
Ejecuta el SQL que se encuentra en `supabase-schema.sql` en el SQL Editor de tu proyecto Supabase.

### 5. Verificar la configuración
1. Inicia el servidor: `npm start` o `node server.js`
2. Abre el navegador en `http://localhost:3001`
3. Verifica en la consola del navegador que aparezca: "✅ Supabase configurado correctamente"
4. Si aparece "⚠️ Supabase no está configurado en el servidor", revisa los pasos anteriores.

## Cómo funciona ahora

1. **Servidor**: Lee las variables de entorno desde el archivo `.env`
2. **API Endpoint**: `/api/supabase-config` sirve la configuración al frontend
3. **Frontend**: Obtiene la configuración dinámicamente y crea el cliente de Supabase
4. **Inicialización**: `initializeAuth()` configura Supabase antes de inicializar la autenticación

## Debugging

Si tienes problemas:

1. **Revisa la consola del servidor** para ver si las variables se cargan:
   ```
   🔑 SUPABASE_URL cargada: SÍ
   🔑 SUPABASE_ANON_KEY cargada: SÍ (longitud: 108)
   ```

2. **Revisa la consola del navegador** para ver mensajes de Supabase

3. **Verifica el endpoint**: Ve a `http://localhost:3001/api/supabase-config` para ver si devuelve la configuración

## Archivos modificados

- ✅ `public/supabase-config.js`: Nuevo sistema de inicialización
- ✅ `public/database.js`: Actualizado para usar `supabase.client`
- ✅ `server.js`: Agregadas variables de entorno y endpoint de configuración
- ✅ `.env.example`: Ya estaba bien configurado

La configuración ahora es más robusta y sigue las mejores prácticas para aplicaciones web.
