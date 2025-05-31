import os
import io
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from groq import Groq
from PyPDF2 import PdfReader

# Load env vars from .env
load_dotenv()

# Initialize FastAPI
app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant",
    version="0.1.0",
)

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

groq_client = Groq(api_key=GROQ_API_KEY)

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
        self.client = groq_client
    
    def call(self, prompt: str) -> str:
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama3-8b-8192",  # You can change this to other Groq models like "mixtral-8x7b-32768"
            )
            return chat_completion.choices[0].message.content
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