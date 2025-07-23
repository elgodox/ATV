# Migración de MetaMask a Supabase

## ¿Qué cambió?

Se ha eliminado la dependencia de MetaMask y se ha implementado un sistema de autenticación tradicional con Supabase que permite:

- **Registro con email y contraseña** (sin necesidad de MetaMask)
- **Favoritos sincronizados en la nube** (ya no se almacenan en localStorage)
- **Acceso desde cualquier dispositivo** 
- **Mayor seguridad y privacidad**
- **Mejor experiencia de usuario**

## Funcionalidades eliminadas

❌ **MetaMask**: Ya no es necesario tener MetaMask instalado
❌ **localStorage para favoritos**: Los favoritos se guardan ahora en Supabase
❌ **Dependencia de blockchain**: Sistema completamente independiente

## Nuevas funcionalidades

✅ **Registro/Login tradicional**: Email y contraseña
✅ **Favoritos en la nube**: Sincronizados entre dispositivos  
✅ **Mejor rendimiento**: Sin dependencias de blockchain
✅ **Acceso universal**: Funciona en cualquier navegador
✅ **Notificaciones mejoradas**: Sistema de mensajes más claro

## Archivos modificados

### Eliminados/Reemplazados:
- Referencias a MetaMask en `app.js`
- Estilos de MetaMask en `styles.css`
- Botón de conexión MetaMask en `index.html`

### Nuevos archivos:
- `supabase-config.js` - Configuración de Supabase
- `supabase-config.example.js` - Ejemplo de configuración
- `supabase-schema.sql` - Script para crear tablas
- `SUPABASE_SETUP.md` - Guía de configuración
- `MIGRATION_NOTES.md` - Este archivo

### Modificados:
- `public/app.js` - Nueva lógica de autenticación
- `public/index.html` - Modal de login/registro
- `public/styles.css` - Estilos para autenticación
- `package.json` - Nueva dependencia de Supabase

## Para desarrolladores

Si vas a continuar el desarrollo:

1. **Instala las dependencias**:
   ```bash
   npm install
   ```

2. **Configura Supabase**:
   - Sigue las instrucciones en `SUPABASE_SETUP.md`
   - Copia `supabase-config.example.js` a `supabase-config.js`
   - Configura tus credenciales de Supabase

3. **Ejecuta el script SQL**:
   - Copia el contenido de `supabase-schema.sql`
   - Ejecútalo en el SQL Editor de Supabase

4. **Inicia el servidor**:
   ```bash
   npm start
   ```

## Migración de datos de usuarios

Si tenías favoritos guardados con MetaMask:

1. Los favoritos anteriores estaban en `localStorage` del navegador
2. Para migrar datos existentes, necesitarías:
   - Registrarte en el nuevo sistema
   - Manualmente volver a agregar tus favoritos
   
**Nota**: No hay migración automática de datos de localStorage a Supabase por razones de seguridad.

## Preguntas frecuentes

**P: ¿Por qué se eliminó MetaMask?**
R: Para simplificar la experiencia del usuario y no requerir instalar extensiones adicionales.

**P: ¿Se perdieron mis favoritos?**
R: Los favoritos de MetaMask estaban en localStorage. Con el nuevo sistema necesitas registrarte y agregar favoritos nuevamente.

**P: ¿Es más seguro que MetaMask?**
R: Sí, Supabase ofrece autenticación robusta y los datos están cifrados en tránsito y reposo.

**P: ¿Puedo usar la app sin registrarme?**
R: Puedes buscar y ver contenido, pero necesitas registrarte para guardar favoritos.

**P: ¿Funciona offline?**
R: La búsqueda y reproducción requieren internet, pero la interfaz funciona sin conexión.

## Soporte técnico

Para problemas con la migración:
1. Revisa `SUPABASE_SETUP.md` para configuración
2. Verifica la consola del navegador para errores
3. Consulta la documentación de Supabase

## Changelog

### v2.0.0 - Migración a Supabase
- Eliminado: MetaMask y dependencias relacionadas
- Agregado: Autenticación con Supabase
- Agregado: Sistema de favoritos en la nube
- Mejorado: Interfaz de usuario y experiencia
- Mejorado: Rendimiento y compatibilidad
