import PyPDF2
import docx
import markdown
from typing import Optional
import io


class DocumentParser:
    """Extract text from various document formats."""

    @staticmethod
    def parse_pdf(file_bytes: bytes) -> str:
        """Extract text from PDF file."""
        try:
            pdf_file = io.BytesIO(file_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            text_content = []
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    text_content.append(text)

            return "\n\n".join(text_content)
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")

    @staticmethod
    def parse_docx(file_bytes: bytes) -> str:
        """Extract text from DOCX file."""
        try:
            docx_file = io.BytesIO(file_bytes)
            doc = docx.Document(docx_file)

            text_content = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_content.append(paragraph.text)

            return "\n\n".join(text_content)
        except Exception as e:
            raise ValueError(f"Failed to parse DOCX: {str(e)}")

    @staticmethod
    def parse_markdown(file_bytes: bytes) -> str:
        """Extract text from Markdown file."""
        try:
            md_text = file_bytes.decode('utf-8')
            # Convert markdown to HTML then strip tags for plain text
            html = markdown.markdown(md_text)
            # For now, just return the raw markdown (more readable for AI)
            return md_text
        except Exception as e:
            raise ValueError(f"Failed to parse Markdown: {str(e)}")

    @staticmethod
    def parse_txt(file_bytes: bytes) -> str:
        """Extract text from plain text file."""
        try:
            return file_bytes.decode('utf-8')
        except Exception as e:
            raise ValueError(f"Failed to parse TXT: {str(e)}")

    @classmethod
    def parse_document(cls, file_bytes: bytes, filename: str) -> str:
        """
        Parse document based on file extension.

        Args:
            file_bytes: Raw file bytes
            filename: Original filename with extension

        Returns:
            Extracted text content

        Raises:
            ValueError: If file format is unsupported or parsing fails
        """
        extension = filename.lower().split('.')[-1]

        parsers = {
            'pdf': cls.parse_pdf,
            'docx': cls.parse_docx,
            'doc': cls.parse_docx,
            'md': cls.parse_markdown,
            'markdown': cls.parse_markdown,
            'txt': cls.parse_txt,
        }

        parser = parsers.get(extension)
        if not parser:
            raise ValueError(
                f"Unsupported file format: .{extension}. "
                f"Supported formats: {', '.join(parsers.keys())}"
            )

        text = parser(file_bytes)

        if not text or len(text.strip()) < 50:
            raise ValueError(
                "Document appears to be empty or too short. "
                "Please provide a document with sufficient content."
            )

        return text
