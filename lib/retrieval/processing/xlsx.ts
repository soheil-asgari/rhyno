import * as XLSX from "xlsx"

export async function processXlsx(blob: Blob) {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: "buffer" })

  let chunks = []

  // Iterate over each sheet in the workbook
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // Convert JSON data to text content
    let content = ""
    for (const row of jsonData) {
      if (Array.isArray(row)) {
        content += row.join(" | ") + "\n"
      }
    }

    // You can split the content into smaller chunks if it's too large
    // For simplicity, we'll treat the entire sheet as one chunk
    chunks.push({
      content,
      tokens: Math.floor(content.length / 4) // A simple token estimation
    })
  }

  return chunks
}
