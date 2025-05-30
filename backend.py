import os
import io
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel
import vertexai
from PyPDF2 import PdfReader

# Load env vars from .env
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant",
    version="0.1.0",
)

# Initialize Vertex AI
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

if PROJECT_ID:
    vertexai.init(project=PROJECT_ID, location=LOCATION)

# --- Pydantic Models ---
class LLMRequest(BaseModel):
    prompt: str

class LLMResponse(BaseModel):
    response: str

class DocumentResponse(BaseModel):
    filename: str
    text: str

# --- Actual LLMTool implementation ---
class LLMTool:
    def __init__(self):
        if not PROJECT_ID:
            raise ValueError("GOOGLE_CLOUD_PROJECT_ID environment variable is required")
        
        # Initialize the Gemini model
        self.model = GenerativeModel("gemini-1.5-pro")
    
    def call(self, prompt: str) -> str:
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

# --- Health check endpoint ---
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SynthesisTalk Backend"}

# --- LLM endpoint ---
@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        tool = LLMTool()
        answer = tool.call(req.prompt)
        return LLMResponse(response=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Document upload & extraction ---
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)