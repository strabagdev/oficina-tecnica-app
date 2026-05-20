# Prisma migrations

Este proyecto ya no debe tratar el schema como un estado implicito aplicado solo con
`prisma db push`. A partir del baseline `20260520_baseline`, los cambios
estructurales deben quedar versionados en `prisma/migrations`.

## Migration vs backfill

- **Migration**: cambia estructura de base de datos: tablas, columnas, enums,
  indices, relaciones o constraints. Vive en `prisma/migrations/<name>/migration.sql`.
- **Backfill**: corrige o inicializa datos existentes despues de una migration.
  Vive en `prisma/backfills/*.sql` y se ejecuta explicitamente.

Ejemplo:

```bash
npx prisma migrate deploy
npx prisma db execute --file prisma/backfills/20260519_contract_item_current_values.sql
```

## Baseline actual

`prisma/migrations/20260520_baseline/migration.sql` representa el schema actual
del proyecto al comenzar el uso formal de Prisma Migrate. En bases existentes,
esta migration debe marcarse como aplicada, no ejecutarse como si la base estuviera
vacia.

```bash
npx prisma migrate resolve --applied 20260520_baseline
```

## Flujo local recomendado

Para cambios nuevos de schema:

```bash
npx prisma migrate dev --name nombre_del_cambio
npx prisma generate
npm run lint
npx tsc --noEmit
```

Committear siempre:

- `prisma/schema.prisma`
- `prisma/migrations/<migration>/migration.sql`
- `prisma/backfills/<backfill>.sql`, si aplica

## Flujo staging / produccion

En bases vivas no usar reset ni `migrate dev`.

```bash
npx prisma migrate deploy
npx prisma generate
```

Si la migration requiere datos iniciales o normalizacion:

```bash
npx prisma db execute --file prisma/backfills/<archivo>.sql
```

Ejecutar verificaciones especificas despues del backfill, por ejemplo conteos de
nulos, saldos o consistencia historica.

## Uso de db push

`prisma db push` queda reservado solo para prototipos locales descartables o
experimentos que no involucren una DB viva. No debe usarse para staging,
produccion, ni bases con snapshots historicos, NOC, cierres EDP o forecast.

## Reglas de seguridad

- No ejecutar `prisma migrate reset` sobre una DB viva.
- No correr `prisma migrate dev` contra produccion o staging.
- No mezclar baseline con cambios funcionales.
- No modificar snapshots historicos mediante migrations salvo backfill auditado.
- Los backfills deben ser idempotentes cuando sea razonable.
- Los cambios de datos criticos deben documentar validacion esperada.

## Compatibilidad contractual

Los snapshots EDP, NOC, itemizado vigente y futuros estados de cierre
(`DRAFT`, `CLOSED`, `REPLACED`) deben evolucionar mediante migrations
versionadas y backfills explicitos. Esto permite auditar el schema sin recalcular
historia contractual.
