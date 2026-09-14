# 🚀 Guía de Despliegue y Operaciones en Producción — PagoCheck

Esta guía detalla los pasos para poner en marcha la plataforma **PagoCheck** en producción con base de datos PostgreSQL en Supabase, funciones Serverless (Edge Functions) para la API bancaria de Banesco, almacenamiento seguro de comprobantes y aislamiento estricto multi-sucursal.

---

## 🏛️ 1. Arquitectura de la Plataforma

- **Frontend**: React 19 + Vite (Single Page Application, totalmente optimizada para dispositivos táctiles y terminales de caja).
- **Base de Datos & Auth**: Supabase (PostgreSQL 15+, Row Level Security RLS, JWT Auth con correos sintéticos `usuario@auth.pagocheck.com`).
- **Almacenamiento**: Supabase Storage (`receipts`, bucket privado con URLs firmadas temporales y compresión en cliente).
- **Backend de Verificación**: Supabase Edge Function (`verify-payment` en Deno/TypeScript), comunicándose de forma segura y server-side con la API de Banesco.
- **Auditoría & Observabilidad**: Tabla inmutable `audit_logs` con medición de latencia bancaria en milisegundos y panel de control para administradores y el dueño.

---

## 📋 2. Despliegue de Base de Datos (Supabase)

### Opción A: Despliegue Unificado (Recomendada)
1. Inicia sesión en tu consola de [Supabase](https://app.supabase.com) y selecciona tu proyecto.
2. Ve al menú lateral izquierdo → **SQL Editor** → **+ New Query**.
3. Abre el archivo [`supabase/deploy_all.sql`](file:///home/anonymity/Proyects/pagocheck/supabase/deploy_all.sql) de este repositorio, copia su contenido completo, pégalo en el editor y haz clic en **Run**.

### Opción B: Despliegue Modular por Fases
Si prefieres ejecutar las migraciones paso a paso o mediante el Supabase CLI (`supabase migration up`), ejecútalas en este orden:
1. `supabase/migrations/001_security_hardening.sql`: RLS base, blindaje contra accesos anónimos y tabla de perfiles.
2. `supabase/migrations/002_seed_auth_users.sql`: Provisión de cuentas en `auth.users` y vinculación a perfiles.
3. `supabase/migrations/003_rbac_branches.sql`: Funciones de contexto de sucursal y aislamiento de movimientos por tienda.
4. `supabase/migrations/004_db_integrity_and_duplicates.sql`: Índice único parcial para prevención de pagos duplicados.
5. `supabase/migrations/005_storage_receipts.sql`: Creación del bucket privado `receipts` y políticas de acceso a imágenes.
6. `supabase/migrations/006_audit_logs.sql`: Creación de la bitácora inmutable de auditoría y políticas de lectura.
7. `supabase/migrations/007_cleanup_legacy_auth.sql`: Erradicación definitiva de entidades y funciones legacy (`app_users`, `verify_login`).

> [!NOTE]
> Para validar las políticas de seguridad en la base de datos, puedes ejecutar las suites de prueba en `supabase/tests/` (`movements_rls.test.sql`, `profiles_rls.test.sql`, `audit_rls.test.sql`).

---

## 🔐 3. Despliegue de la Edge Function (API Banesco)

La Edge Function `verify-payment` gestiona la consulta bancaria del lado del servidor, protegiendo las credenciales maestras del negocio.

### Requisitos:
Tener instalado y autenticado [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
npx supabase login
npx supabase link --project-ref tu-project-ref
```

### Configuración de Secretos Bancarios:
Configura las credenciales suministradas por Banesco para el comercio:
```bash
npx supabase secrets set \
  BANESCO_API_URL="https://api.banesco.com/api/v1/pagos/verificar" \
  BANESCO_CLIENT_ID="tu-client-id" \
  BANESCO_CLIENT_SECRET="tu-client-secret" \
  BANESCO_MASTER_ACCOUNT="01340000000000000000" \
  BANESCO_MASTER_PHONE="04141234567" \
  BANESCO_MASTER_RIF="J123456789"
```

### Despliegue de la función:
```bash
npx supabase functions deploy verify-payment --no-verify-jwt
```

---

## 🌐 4. Configuración del Frontend (Variables de Entorno)

En el servicio de hosting donde compiles el frontend (Vercel, Netlify, Cloudflare Pages o servidor propio con Nginx):

Crea las variables de entorno basadas en `.env.example`:
```ini
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

### Comandos de Compilación:
```bash
# Instalar dependencias
npm install

# Compilar para producción
npm run build
```
Los archivos optimizados para producción se generarán en la carpeta `dist/`.

---

## 👥 5. Cuentas Operativas Iniciales

El sistema incluye las siguientes cuentas configuradas con aislamiento por sucursal:

| Rol | Usuario | Contraseña Inicial | Sucursal / Alcance | Acceso a Auditoría |
| :--- | :--- | :--- | :--- | :--- |
| **Dueño / General** | `admin` | `admin123` | **Todas las sucursales** (Consolidado) | ✅ Completa |
| **Supervisor** | `admin_t1` | `admin1` | Tienda 1 (Bella Vista) | ✅ Solo Tienda 1 |
| **Cajero** | `caja1` | `caja1` | Tienda 1 (Bella Vista) | ❌ No |
| **Cajero** | `caja2` | `caja2` | Tienda 1 (Bella Vista) | ❌ No |
| **Cajero** | `caja3` | `caja3` | Tienda 1 (Bella Vista) | ❌ No |
| **Supervisor** | `admin_t2` | `admin2` | Tienda 2 (Altamira) | ✅ Solo Tienda 2 |
| **Cajero** | `t2_caja1` | `caja1` | Tienda 2 (Altamira) | ❌ No |
| **Cajero** | `t2_caja2` | `caja2` | Tienda 2 (Altamira) | ❌ No |
| **Cajero** | `t2_caja3` | `caja3` | Tienda 2 (Altamira) | ❌ No |
| **Supervisor** | `admin_t3` | `admin3` | Tienda 3 (La Trinidad) | ✅ Solo Tienda 3 |
| **Cajero** | `t3_caja1` | `caja1` | Tienda 3 (La Trinidad) | ❌ No |
| **Cajero** | `t3_caja2` | `caja2` | Tienda 3 (La Trinidad) | ❌ No |
| **Cajero** | `t3_caja3` | `caja3` | Tienda 3 (La Trinidad) | ❌ No |
| **Supervisor** | `admin_camion` | `admincamion` | Camión Móvil (Ruta) | ✅ Solo Camión |
| **Cajero** | `camion_caja1` | `camion` | Camión Móvil (Ruta) | ❌ No |
| **Bot Servicio** | `bot_service` | `bot` | WhatsApp / Delivery | ❌ No |

> [!TIP]
> Cada usuario puede cambiar su contraseña desde la pestaña **Seguridad** del menú de configuración. El dueño general puede además gestionar los parámetros del negocio y la política de retención de imágenes en la pestaña **Almacenamiento**.

---

## 🧪 6. Comandos de Verificación del Sistema

Para certificar la integridad de la aplicación antes de cualquier despliegue:

```bash
# Ejecutar suite completa de pruebas (Adaptadores, Storage, OCR, Auditoría y E2E)
npm run test:all

# Verificación de linter (0 errores requeridos)
npm run lint

# Verificación de compilación Vite
npm run build
```
