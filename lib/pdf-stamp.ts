"use server"

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib"
import { readFile } from "fs/promises"
import sharp from "sharp"

export interface StampCategory {
  name: string
  color: string
}

export interface StampItem {
  name: string
  total?: number
  currencyCode?: string
  category?: StampCategory | null
}

export interface StampData {
  transactionName?: string | null
  merchant?: string | null
  issuedAt?: Date | null
  total?: number | null
  currencyCode?: string | null
  category?: StampCategory | null
  project?: { name: string; color: string } | null
  items?: StampItem[]
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "")
  const r = parseInt(cleaned.substring(0, 2), 16) / 255
  const g = parseInt(cleaned.substring(2, 4), 16) / 255
  const b = parseInt(cleaned.substring(4, 6), 16) / 255
  return { r, g, b }
}

function formatCents(total: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(total / 100)
  } catch {
    return `${currency} ${(total / 100).toFixed(2)}`
  }
}

async function loadFileAsPdf(filePath: string, mimetype: string): Promise<PDFDocument> {
  const fileBuffer = await readFile(filePath)

  if (mimetype === "application/pdf") {
    return await PDFDocument.load(fileBuffer)
  }

  // Convert image to PDF
  // Normalize to PNG via sharp for pdf-lib compatibility
  const pngBuffer = await sharp(fileBuffer).png().toBuffer()
  const metadata = await sharp(fileBuffer).metadata()

  const pdfDoc = await PDFDocument.create()
  const imgWidth = metadata.width || 595
  const imgHeight = metadata.height || 842

  // Scale to fit A4 (595x842) while preserving aspect ratio
  const maxWidth = 555 // A4 width minus margins
  const maxHeight = 762 // A4 height minus margins for stamp
  const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1)
  const scaledWidth = imgWidth * scale
  const scaledHeight = imgHeight * scale

  const page = pdfDoc.addPage([595, Math.max(842, scaledHeight + 80)])
  const pngImage = await pdfDoc.embedPng(pngBuffer)
  page.drawImage(pngImage, {
    x: (595 - scaledWidth) / 2,
    y: page.getHeight() - scaledHeight - 20,
    width: scaledWidth,
    height: scaledHeight,
  })

  return pdfDoc
}

function drawCategoryBanner(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  stamp: StampData
) {
  const pageWidth = page.getWidth()
  const bannerHeight = 50
  const bannerY = 0

  // Background
  const categoryColor = stamp.category ? hexToRgb(stamp.category.color) : { r: 0.3, g: 0.3, b: 0.3 }
  page.drawRectangle({
    x: 0,
    y: bannerY,
    width: pageWidth,
    height: bannerHeight,
    color: rgb(categoryColor.r, categoryColor.g, categoryColor.b),
    opacity: 0.9,
  })

  // Category label
  const labelX = 15
  const textY = bannerY + 18
  if (stamp.category) {
    page.drawText(stamp.category.name.toUpperCase(), {
      x: labelX,
      y: textY,
      size: 14,
      font: boldFont,
      color: rgb(1, 1, 1),
    })
  }

  // Project badge (if present)
  if (stamp.project) {
    const projectColor = hexToRgb(stamp.project.color)
    const projectText = stamp.project.name
    const projectTextWidth = font.widthOfTextAtSize(projectText, 10)
    const badgeX = pageWidth - projectTextWidth - 30
    page.drawRectangle({
      x: badgeX - 5,
      y: textY - 4,
      width: projectTextWidth + 20,
      height: 18,
      color: rgb(projectColor.r, projectColor.g, projectColor.b),
      opacity: 0.85,
      borderColor: rgb(1, 1, 1),
      borderWidth: 1,
    })
    page.drawText(projectText, {
      x: badgeX + 5,
      y: textY,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    })
  }

  // Total + date line
  const metaParts: string[] = []
  if (stamp.total != null && stamp.currencyCode) {
    metaParts.push(formatCents(stamp.total, stamp.currencyCode))
  }
  if (stamp.issuedAt) {
    metaParts.push(stamp.issuedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }))
  }
  if (stamp.merchant) {
    metaParts.push(stamp.merchant)
  }
  if (metaParts.length > 0) {
    const metaText = metaParts.join("  |  ")
    const metaWidth = font.widthOfTextAtSize(metaText, 9)
    page.drawText(metaText, {
      x: stamp.project ? labelX : pageWidth - metaWidth - 15,
      y: bannerY + 35,
      size: 9,
      font,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    })
  }
}

function drawItemsOverlay(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  items: StampItem[],
  startY: number
) {
  if (items.length === 0) return

  const pageWidth = page.getWidth()
  const overlayWidth = Math.min(pageWidth - 40, 300)
  const lineHeight = 14
  const padding = 8
  const overlayHeight = padding * 2 + items.length * lineHeight + 20
  const overlayX = pageWidth - overlayWidth - 20

  // Semi-transparent background
  page.drawRectangle({
    x: overlayX,
    y: startY - overlayHeight,
    width: overlayWidth,
    height: overlayHeight,
    color: rgb(1, 1, 1),
    opacity: 0.85,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
  })

  // Header
  let curY = startY - padding - 12
  page.drawText("LINE ITEMS", {
    x: overlayX + padding,
    y: curY,
    size: 8,
    font: boldFont,
    color: rgb(0.4, 0.4, 0.4),
  })
  curY -= lineHeight + 2

  // Items
  for (const item of items) {
    // Category color dot
    if (item.category) {
      const dotColor = hexToRgb(item.category.color)
      page.drawCircle({
        x: overlayX + padding + 4,
        y: curY + 3,
        size: 4,
        color: rgb(dotColor.r, dotColor.g, dotColor.b),
      })
    }

    // Item name (truncate if too long)
    const nameX = overlayX + padding + (item.category ? 14 : 0)
    const maxNameWidth = overlayWidth - padding * 2 - (item.category ? 14 : 0) - 70
    let displayName = item.name || "Unknown"
    while (font.widthOfTextAtSize(displayName, 9) > maxNameWidth && displayName.length > 3) {
      displayName = displayName.slice(0, -4) + "..."
    }
    page.drawText(displayName, {
      x: nameX,
      y: curY,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1),
    })

    // Item total
    if (item.total != null && item.currencyCode) {
      const totalText = formatCents(item.total, item.currencyCode)
      const totalWidth = font.widthOfTextAtSize(totalText, 9)
      page.drawText(totalText, {
        x: overlayX + overlayWidth - padding - totalWidth,
        y: curY,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3),
      })
    }

    // Category name label
    if (item.category) {
      const catColor = hexToRgb(item.category.color)
      page.drawText(item.category.name, {
        x: nameX,
        y: curY - 9,
        size: 7,
        font,
        color: rgb(catColor.r, catColor.g, catColor.b),
      })
      curY -= 8
    }

    curY -= lineHeight
  }
}

export async function createStampedPdf(
  filePath: string,
  mimetype: string,
  stamp: StampData
): Promise<Uint8Array> {
  const pdfDoc = await loadFileAsPdf(filePath, mimetype)

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pages = pdfDoc.getPages()

  // Add category banner to every page (bottom)
  for (const page of pages) {
    drawCategoryBanner(page, font, boldFont, stamp)
  }

  // Add items overlay on first page only
  if (stamp.items && stamp.items.length > 0 && pages.length > 0) {
    const firstPage = pages[0]
    const itemsStartY = 60 + stamp.items.length * 14 + 30
    drawItemsOverlay(firstPage, font, boldFont, stamp.items, itemsStartY)
  }

  return await pdfDoc.save()
}
