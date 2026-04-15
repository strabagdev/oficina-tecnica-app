import * as XLSX from "xlsx";

export async function GET() {
  const workbook = XLSX.utils.book_new();

  const templateRows = [
    {
      familia: "Movimiento de tierras",
      subfamilia: "Excavaciones",
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
    ["familia", "No", "Familia principal para clasificar la partida."],
    ["subfamilia", "No", "Subfamilia dentro de la familia. Puede quedar vacia."],
    ["grupo", "No", "Grupo o bloque interno dentro de la subfamilia. Puede quedar vacio."],
    ["numeroItem", "Si", "Numero de itemizado que define el orden real de la partida."],
    ["descripcion", "Si", "Descripcion de la partida o item."],
    ["unidad", "No", "Unidad de medida, por ejemplo m3, m2, gl, ml."],
    ["cantidad", "Si", "Cantidad contractual base de la partida."],
    ["precioUnitario", "Si", "Precio unitario contractual."],
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
