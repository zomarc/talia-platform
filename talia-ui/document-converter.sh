#!/bin/bash

# Universal Document Converter for Talia
# Converts any markdown document to professional PDF-ready HTML

if [ $# -eq 0 ]; then
    echo "Usage: ./document-converter.sh <markdown-file.md>"
    echo "Example: ./document-converter.sh TALIA-Business-Goals-Actions.md"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${INPUT_FILE%.md}.html"

echo "Converting $INPUT_FILE to professional HTML document..."

# Create professional HTML with Talia branding
cat > "$OUTPUT_FILE" << 'HTML_EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Talia Business Intelligence Platform</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1 {
            color: #2E86AB;
            text-align: center;
            border-bottom: 2px solid #2E86AB;
            padding-bottom: 10px;
        }
        h2 {
            color: #2E86AB;
            margin-top: 30px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        h3 {
            color: #6C757D;
            margin-top: 25px;
        }
        h4 {
            color: #6C757D;
            margin-top: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .highlight {
            background-color: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #2E86AB;
            margin: 20px 0;
        }
        @media print {
            body { margin: 0; }
            h1 { page-break-before: avoid; }
            h2 { page-break-after: avoid; }
        }
    </style>
</head>
<body>
HTML_EOF

# Convert markdown to HTML and append
pandoc "$INPUT_FILE" --standalone --metadata title="Talia Business Intelligence Platform" >> "$OUTPUT_FILE"

# Close HTML
echo "</body></html>" >> "$OUTPUT_FILE"

echo "✅ Professional HTML document created: $OUTPUT_FILE"
echo ""
echo "📄 To create PDF:"
echo "1. Open $OUTPUT_FILE in your browser"
echo "2. Press Ctrl+P (or Cmd+P on Mac)"
echo "3. Select 'Save as PDF'"
echo "4. Choose professional settings"
echo "5. Save the PDF"
echo ""
echo "🎯 Document ready for sharing!"
