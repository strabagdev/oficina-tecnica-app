import * as XLSX from "xlsx";

export async function GET() {
  const workbook = XLSX.utils.book_new();

  const templateRows = [
    {
      familiaWbs: "1",
      familia: "Movimiento de tierras",
      subfamiliaWbs: "1.1",
      subfamilia: "Excavaciones",
      grupoWbs: "1.1.1",
      grupo: "Terraplenes",
      numeroItem: "1.1",
      descripcion: "Movimiento de tierras",
      unidad: "m3",
      cantidad: 1200,
      precioUnitario: 18500,
    },
  ];

  const templateSheet = XLSX.utils.json_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Partidas");

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ["Campo", "Obligatorio", "Descripcion"],
    ["familiaWbs", "No", "WBS de la familia. Recomendado para evitar ambiguedades."],
    ["familia", "No", "Familia principal para clasificar la partida."],
    ["subfamiliaWbs", "No", "WBS de la subfamilia. Recomendado si hay nombres repetidos."],
    ["subfamilia", "No", "Subfamilia dentro de la familia. Puede quedar vacia."],
    ["grupoWbs", "No", "WBS del grupo. Recomendado si hay nombres repetidos."],
    ["grupo", "No", "Grupo o bloque interno dentro de la subfamilia. Puede quedar vacio."],
    ["numeroItem", "Si", "Numero de itemizado que define el orden real de la partida."],
    ["descripcion", "Si", "Descripcion de la partida o item."],
    ["unidad", "No", "Unidad de medida, por ejemplo m3, m2, gl, ml."],
    ["cantidad", "Si", "Cantidad contractual base de la partida."],
    ["precioUnitario", "Si", "Precio unitario contractual."],
    [],
    ["Jerarquia", "Recomendado", "Si informas WBS y nombre, el sistema prioriza el WBS."],
    ["Modo create", "Si", "Cada numeroItem del archivo debe ser nuevo dentro del contrato."],
    ["Modo update", "Si", "Cada numeroItem del archivo debe existir previamente en el contrato."],
    ["Validacion", "Si", "El sistema valida todas las filas antes de insertar o actualizar."],
  ]);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-partidas.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
