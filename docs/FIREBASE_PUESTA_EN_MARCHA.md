# Poner Zentra en marcha con Firebase

Estado comprobado el 4 de octubre de 2026 en este equipo. Esta guía usa el
proyecto y la base de datos que tiene configurados Zentra.

## Lo que falta ahora

| Elemento                                               | Estado local                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Proyecto de Firebase                                   | `gen-lang-client-0508893636`                                   |
| Base de datos Firestore                                | `ai-studio-dded2304-8d23-4a7f-9f9a-5c418ec4c2b3`               |
| Coincidencia de configuración entre cliente y servidor | Comprobada                                                     |
| Sesión de Firebase CLI                                 | Iniciada y con acceso al proyecto                              |
| Credenciales de Firebase Admin                         | Configuradas; acceso a Auth y lectura de Firestore comprobados |
| Archivo de despliegue para la base indicada            | Generado localmente                                            |
| Despliegue de reglas e índices en producción           | Reglas verificadas; los cinco índices están READY              |
| Acceso por correo/contraseña y Google                  | Habilitados y comprobados en la configuración remota           |
| Gemini, Twelve Data y NewsAPI                          | Claves presentes; esto no verifica sus planes ni sus cuotas    |
| Clave pública VAPID para push                          | Falta                                                          |
| Resend, Finnhub y API oficial de X                     | Claves ausentes                                                |

El servidor local se reinició con la ruta de credenciales que agregaste al `.env`.
Responde en `http://localhost:3000` y `/api/ready` devuelve `firebaseAdmin: true` y
`status: ready`. Se comprobó acceso real a Firebase Auth y lectura de la base
Firestore configurada. Las reglas publicadas coinciden con `firestore.rules`.
Correo/contraseña y Google están habilitados. `localhost`, `127.0.0.1` y
`zentra-bbpe.onrender.com` están entre los dominios autorizados.

## 1. Revisar el proyecto y habilitar el acceso

Este paso ya se comprobó en el proyecto actual. Conservá estas instrucciones para
otro entorno o para agregar un dominio nuevo.

Abrí la [consola del proyecto](https://console.firebase.google.com/project/gen-lang-client-0508893636/overview)
con la cuenta de Google que administra Firebase.

1. En Firestore Database, seleccioná y confirmá la base
   `ai-studio-dded2304-8d23-4a7f-9f9a-5c418ec4c2b3`. Es la que consulta Zentra;
   no uses otra base para este despliegue.
2. En Authentication → Sign-in method, habilitá **Email/Password** y **Google**.
   Configurá el correo de soporte que pide Google.
3. En Authentication → Settings → Authorized domains, verificá `localhost` y
   `127.0.0.1`. Agregá también el dominio real de publicación cuando lo tengas,
   sin `https://`, puertos ni rutas.

Guías oficiales: [correo y contraseña](https://firebase.google.com/docs/auth/web/password-auth)
y [Google](https://firebase.google.com/docs/auth/web/google-signin).

## 2. Dar al servidor acceso con Firebase Admin

Este paso ya quedó completado en este equipo. Las instrucciones siguientes quedan
como referencia para configurar otro entorno o el hosting.

En Project settings → Service accounts → Firebase Admin SDK, generá y descargá
la clave privada JSON del proyecto. Guardala **fuera del repositorio** y mantenela
privada. No la pegues en el chat ni la incluyas en el frontend.

Por ejemplo, creá una carpeta privada y guardá el archivo descargado en:

```text
C:/Users/Carlos/.codex/secrets/zentra-firebase-admin.json
```

Editá únicamente estas variables del `.env` existente en la raíz del proyecto.
La primera ruta debe apuntar al archivo que realmente guardaste:

```dotenv
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/Carlos/.codex/secrets/zentra-firebase-admin.json
FIREBASE_PROJECT_ID=gen-lang-client-0508893636
FIREBASE_DATABASE_ID=ai-studio-dded2304-8d23-4a7f-9f9a-5c418ec4c2b3
FIREBASE_DATABASE_EDITION=ENTERPRISE
DEMO_MODE=false
```

Conservá las claves de proveedores que ya tiene el archivo. Dejá
`FIREBASE_SERVICE_ACCOUNT_JSON` vacío si usás la ruta del JSON.

Reiniciá el proceso `npm.cmd run dev` después de guardar. Admin permite al servidor
evaluar alertas, guardar valoraciones automáticas, comprobar revocación de sesiones
y eliminar cuentas. El acceso básico de usuario también usa el SDK cliente y
puede funcionar sin Admin, pero esas tareas del servidor requieren Admin.

En el hosting, guardá el JSON como secreto en `FIREBASE_SERVICE_ACCOUNT_JSON`,
o montá el archivo privado y configurá `GOOGLE_APPLICATION_CREDENTIALS`. Esta
versión del servidor requiere una de esas dos opciones explícitas.

Referencia: [configuración oficial de Firebase Admin](https://firebase.google.com/docs/admin/setup).

## 3. Publicar las reglas y los índices correctos

Las reglas ya se publicaron el 4 de octubre de 2026. Los cinco índices Enterprise
para alertas, notificaciones y valoraciones históricas se comprobaron en estado
`READY`. Se guardó una copia de
las reglas y los índices anteriores en `.codex-runtime/firebase-backups/`.
Estas instrucciones quedan para futuros despliegues.

Abrí PowerShell y ejecutá:

```powershell
Set-Location 'F:\Repositorio\Zentra'
npx.cmd firebase-tools@15.32.1 login
npx.cmd firebase-tools@15.32.1 projects:list
```

Iniciá sesión con la cuenta que tiene permisos sobre el proyecto. Confirmá que
`gen-lang-client-0508893636` aparece entre los proyectos accesibles. Revisá las
reglas actuales y conservá una copia antes de reemplazarlas si ya hay usuarios.

Después ejecutá:

```powershell
npm.cmd run firebase:prepare-deploy
npx.cmd firebase-tools@15.32.1 deploy --config .codex-runtime/firebase.deploy.json --only firestore --project gen-lang-client-0508893636
```

El archivo generado apunta a la base con nombre indicada arriba. Usá este comando
completo: el `firebase.json` general del repositorio se usa para herramientas
locales con la base predeterminada. `FIREBASE_DATABASE_EDITION=ENTERPRISE` selecciona
`firestore.enterprise.indexes.json`, compatible con la edición real de esta base.
Esperá a que los índices de Firestore terminen
de construirse si la consola los muestra como pendientes.

Referencias: [inicio de sesión en la CLI](https://firebase.google.com/docs/cli#sign-in-test-cli)
y [bases de datos de Firestore](https://firebase.google.com/docs/firestore/manage-databases).

## 4. Configurar las notificaciones push

En Project settings → Cloud Messaging → Web configuration → Web Push
certificates, generá un par de claves. Copiá la clave **pública VAPID** en:

```dotenv
VITE_FIREBASE_MESSAGING_VAPID_KEY=LA_CLAVE_PUBLICA_GENERADA
```

Configurala también en el entorno de compilación del hosting. Las variables
`VITE_` se incorporan al frontend al compilar: en producción hace falta volver a
compilar y publicar después de cambiarlas. El navegador debe dar permiso para
notificaciones y la publicación debe usar HTTPS. El servidor necesita Admin para
enviar las notificaciones.

La presencia de la clave no confirma la entrega: probala desde una cuenta propia
cuando el despliegue esté listo.

Referencia: [Firebase Cloud Messaging para web](https://firebase.google.com/docs/cloud-messaging/web/get-started).

## 5. Completar las funciones que usan otros servicios

Firebase gestiona usuarios, datos y push. Los precios, noticias, lectura de
comprobantes y otros servicios también necesitan sus propios proveedores.

| Función                      | Configuración necesaria                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Lectura de comprobantes e IA | `GEMINI_API_KEY`; ya presente localmente                                                                   |
| Cotizaciones de acciones     | `TWELVE_DATA_API_KEY`; ya presente localmente                                                              |
| Noticias                     | `NEWS_API_KEY`; ya presente localmente                                                                     |
| Correos de soporte y alertas | `RESEND_API_KEY`, `SUPPORT_FROM_EMAIL`, `SUPPORT_TO_EMAIL` y remitente verificado                          |
| Calendario de resultados     | `FINNHUB_API_KEY`                                                                                          |
| Publicaciones de X           | `X_BEARER_TOKEN` y acceso al servicio oficial                                                              |
| Wallets EVM y Solana         | RPC públicos como alternativa actual; endpoints propios opcionales para mejorar capacidad y disponibilidad |

Comprobá acceso, cuotas y condiciones de producción de los proveedores elegidos.
Copiá las claves privadas al entorno protegido del servidor publicado. No las
conviertas en variables `VITE_`.

## 6. Publicar el servidor y el frontend

Zentra usa un servidor Node/Express para `/api/*` y tareas automáticas. El hosting
debe ejecutar ese servidor y servir el frontend por HTTPS, preferentemente bajo
el mismo dominio. El repositorio también incluye un `Dockerfile`.

El arranque de producción es:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Configurá `NODE_ENV=production`, `DEMO_MODE=false`, los identificadores de Firebase,
las credenciales Admin y los proveedores en el hosting. La clave VAPID tiene que
estar disponible durante la compilación. Conservá una instancia activa para que
las tareas periódicas sigan trabajando. Publicar solamente los archivos estáticos
de `dist` no ejecuta esas tareas ni los endpoints del servidor.

Para empezar, mantené una instancia del servidor. Si agregás más instancias,
configurá Redis para compartir caché y límites de proveedores, y coordiná las
tareas periódicas. Revisá el uso y los planes de Firebase, configurá alertas de
presupuesto y una política de copias de seguridad antes del acceso público. Las
alertas de presupuesto avisan; no detienen por sí solas el gasto.

Referencias: [operación de este repositorio](./DEPLOYMENT.md) y
[planes de Firebase](https://firebase.google.com/pricing).

## 7. Comprobar el funcionamiento después de configurar

Con el servidor reiniciado, abrí `http://localhost:3000/api/ready`. Con las
credenciales y la configuración principal válidas, debería mostrar
`firebaseAdmin: true` y `status: ready`. Es una comprobación de configuración;
no sustituye las pruebas reales de permisos y proveedores.

Ejecutá el diagnóstico local:

```powershell
npm.cmd run doctor
```

Para el despliegue, reemplazá el dominio de ejemplo por el real:

```powershell
$env:ZENTRA_BASE_URL='https://TU_DOMINIO_REAL'
npm.cmd run doctor
```

Desde una cuenta propia, comprobá el acceso por correo y Google, la persistencia
al recargar del asset añadido, un comprobante con revisión de sus datos, las
wallets EVM y Solana, noticias en los tres idiomas y las alertas. La importación
de comprobantes conserva la revisión del usuario antes de guardar la compra.
Confirmá también la entrega de push y correo si habilitaste esos canales.

El código tuvo validación local previa. El acceso Admin, las reglas publicadas,
los proveedores de autenticación y los dominios se comprobaron en Firebase real.
Las pruebas completas desde una cuenta propia, el hosting y la configuración
de push y proveedores opcionales siguen pendientes. No se hizo una prueba de
carga de 400 usuarios concurrentes.
