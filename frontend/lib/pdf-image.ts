import type { jsPDF } from "jspdf";

/** Fit the whole image inside its reserved space without stretching or cropping. */
export function addContainedPdfImage(
  pdf: jsPDF,
  dataUrl: string,
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
    align?: "left" | "center" | "right";
  }
) {
  const image = pdf.getImageProperties(dataUrl);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const offsetX = box.align === "right" ? box.width - width
    : box.align === "center" ? (box.width - width) / 2 : 0;

  pdf.addImage(dataUrl, image.fileType, box.x + offsetX,
    box.y + (box.height - height) / 2, width, height);
}
