# PDF Upload Backend Examples

## Environment

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/express-backend
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Postman Book Upload Request

Method: `POST`

URL: `http://localhost:5000/api/book`

Body type: `form-data`

Headers:

```text
Authorization: Bearer your_jwt_token
```

Fields:

```text
coverImage: choose an image file
pdfFile: choose a .pdf file
title: My Book Title
author: Author Name
summary: Book summary
category: Category Name
price: 0
status: published
```

## Iframe Preview

```html
<iframe
  src="https://res.cloudinary.com/your-cloud/raw/upload/fl_attachment:false/pdfs/file.pdf"
  width="100%"
  height="700"
  title="PDF preview"
></iframe>
```

## React PDF Preview

```jsx
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PdfPreview({ pdfUrl }) {
  return (
    <Document file={pdfUrl}>
      <Page pageNumber={1} />
    </Document>
  );
}
```

The API stores Cloudinary URLs with `fl_attachment:false` so browsers, iframes, embeds, `react-pdf`, Next.js, and React Native WebView can preview the PDF instead of being forced into download mode.
