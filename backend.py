import os
import io
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from google.cloud import aiplatform
from PyPDF2 import PdfReader

# Load env vars from .env
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant",
    version="0.1.0",
)

# --- Missing Pydantic Models ---
class LLMRequest(BaseModel):
    prompt: str

class LLMResponse(BaseModel):
    response: str

# --- Placeholder LLMTool class ---
class LLMTool:
    def call(self, prompt: str) -> str:
        # Placeholder implementation
        return f"Response to: {prompt}"

# --- Health check and LLMTool omitted for brevity ---

# --- LLM schemas omitted for brevity ---

@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        tool = LLMTool()
        answer = tool.call(req.prompt)
        return LLMResponse(response=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- New Section: Document upload & extraction ---

class DocumentResponse(BaseModel):
    filename: str
    text: str

@app.post("/api/documents", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Accepts a PDF or plain-text file, extracts its text, and returns it.
    """
    try:
        content = await file.read()
        if file.content_type == "application/pdf":
            reader = PdfReader(io.BytesIO(content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
        elif file.content_type.startswith("text/"):
            text = content.decode(errors="ignore")
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type")

        return DocumentResponse(filename=file.filename, text=text)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {e}")