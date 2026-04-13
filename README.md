# Oficina Tecnica Contractual

Base inicial para controlar:

- itemizado de contrato
- consumo mensual por item
- cierres mensuales o estados de pago con snapshot del itemizado
- descuentos mensuales por porcentaje o por cantidad
- cambios contractuales tipo NOC en cantidades o montos
- acceso simple con perfiles `ADMIN` y `VIEWER`

## Stack inicial

- Next.js 16 App Router
- Prisma
- PostgreSQL pensado para Railway
- autenticacion simple con cookie segura y sesiones en base de datos

## Variables de entorno

Usa `.env.example` como referencia:

```bash
DATABASE_URL="postgresql://..."
ADMIN_EMAIL="admin@empresa.cl"
ADMIN_PASSWORD="CambiaEstaClave123!"
VIEWER_EMAIL="viewer@empresa.cl"
VIEWER_PASSWORD="CambiaEstaClave123!"
```

Si corres el proyecto localmente sin definir usuarios y no estas en `production`, se crean credenciales de inicio rapido:

- `admin@oficina.local / Admin1234!`
- `viewer@oficina.local / Viewer1234!`

## Desarrollo local

```bash
npm install
npm run db:push
npm run dev
```

## Railway

1. Crea un servicio PostgreSQL en Railway.
2. Configura `DATABASE_URL` en la app.
3. Define `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VIEWER_EMAIL` y `VIEWER_PASSWORD`.
4. Ejecuta migracion o sincronizacion antes del primer uso:

```bash
npm run db:deploy
```

Si aun no tienes migraciones versionadas, puedes partir con:

```bash
npm run db:push
```

## Base de datos inicial

El esquema ya incluye:

- `User`
- `Session`
- `Contract`
- `ContractItem`
- `MonthlyConsumption`
- `MonthlyClosure`
- `MonthlyClosureItemSnapshot`
- `ContractChange`

## Reglas del negocio consideradas

- Cada cierre mensual representa una imagen del itemizado al cierre de ese mes.
- El cierre guarda snapshot por item para no recalcular historicos cuando el contrato cambie despues.
- Los descuentos mensuales pueden expresarse de dos formas:
- `PERCENTAGE`: descuento sobre el 100% o sobre el avance del item.
- `QUANTITY`: descuento en unidades del item, por ejemplo `m3`, `m2`, `gl`, etc.
- El consumo mensual puede guardar tanto el bruto del mes como el neto pagable luego del descuento.

## Siguiente iteracion recomendada

1. CRUD de contratos e importacion de itemizado.
2. Pantalla de cierre mensual y estado de pago con snapshot por item.
3. Registro de descuentos por porcentaje o cantidad segun unidad de medida.
4. Pantalla de NOC con aprobacion y trazabilidad.
5. Reportes de saldo contractual, consumido y proyectado.
