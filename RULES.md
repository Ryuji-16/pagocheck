# 🧩 Reglas para trabajar en PagoCheck

> *"No queremos código que simplemente funcione; queremos código que siga siendo entendible cuando otra persona tenga que modificarlo."*

Antes de comenzar a modificar el proyecto, hay algo importante: **no solucionamos cambios de diseño agregando código encima del código existente**.

---

### 1. No duplicar CSS para sobrescribir CSS anterior
> *"Nunca agregues una regla CSS únicamente para sobrescribir una regla anterior. Primero localiza la regla original y modifícala directamente. Si realmente necesitas una nueva regla o una excepción, debe existir una razón clara para ello."*

Si una regla CSS ya existe, se modifica esa regla. No se crea otra al final del archivo para taparla.

### 2. Antes de agregar código, buscar si ya existe
Esto aplica también para JavaScript y JSX.
Antes de crear algo nuevo, pregúntate: *“¿Esto ya existe en otro lugar del proyecto?”*
Primero revisamos si podemos modificar o reutilizar lo existente en lugar de duplicar funciones.

### 3. Si un cambio reemplaza algo anterior, eliminar lo anterior
No queremos código muerto.
Si una clase, función, variable o componente ya no se utiliza, se elimina limpiamente, siempre comprobando primero que realmente no tenga otra utilidad.

### 4. No usar CSS como una batalla de especificidad
La prioridad debe ser:
`estructura clara → clase correcta → regla correcta → resultado visual.`
No encadenar selectores innecesarios ni usar `!important` para ganar una batalla de especificidad.

### 5. Mantener cada cosa en su lugar
El proyecto está organizado por responsabilidades:
- `src/components/`: Componentes modulares.
- `src/components/css/`: Estilos propios de cada componente.
- `src/services/`: Lógica de negocio, APIs y servicios.
- `src/styles/`: Variables y estilos globales.
No meter todo en `App.jsx` solamente porque sea más fácil.

### 6. Los cambios deben ser quirúrgicos
Modificar la menor cantidad de código posible para lograr el objetivo. Tocar únicamente la regla o bloque específico sin rehacer código que ya funciona.

### 7. Cada commit debe representar un cambio concreto
Commits descriptivos y atómicos (`feat:`, `fix:`, `style:`, etc.) para saber qué cambió y por qué.

### 8. Antes del commit, probar
Comprobar que la aplicación arranca, sin errores en consola, funcionalidad intacta y sin código duplicado.

---

### 🔴 Regla de oro para colaboradores
> *"Si no entiendes por qué existe una parte del código, no la reemplaces inmediatamente. Pregunta o investiga primero qué función cumple."*
