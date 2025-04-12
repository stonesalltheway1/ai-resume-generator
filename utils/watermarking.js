/**
 * Watermarking utilities for exported documents
 */

// Add text watermark to HTML
function addTextWatermark(html, licenseKey) {
  const watermarkText = `<!-- Created with AI Resume Generator | License: ${licenseKey} -->`;
  return html.replace('</body>', `${watermarkText}</body>`);
}

// Add visual watermark to HTML
function addVisualWatermark(html) {
  const watermarkStyle = `
  <style>
    @media screen {
      body::after {
        content: "AI Resume Generator";
        position: fixed;
        bottom: 5px;
        right: 5px;
        font-size: 10px;
        color: rgba(0,0,0,0.1);
        transform: rotate(-45deg);
        pointer-events: none;
      }
    }
    
    @media print {
      body::after {
        display: none;
      }
    }
  </style>
  `;
  
  return html.replace('</head>', `${watermarkStyle}</head>`);
}

// Add metadata watermark to PDF
function addMetadataWatermark(pdfBuffer, licenseKey) {
  // This would typically be done with a PDF manipulation library
  // For Electron, this is handled during the PDF generation process
  return pdfBuffer;
}

// Add all watermarks
function watermarkDocument(html, licenseKey) {
  // Add text watermark
  let watermarkedHtml = addTextWatermark(html, licenseKey);
  
  // Add visual watermark
  watermarkedHtml = addVisualWatermark(watermarkedHtml);
  
  return watermarkedHtml;
}

module.exports = {
  addTextWatermark,
  addVisualWatermark,
  addMetadataWatermark,
  watermarkDocument
};