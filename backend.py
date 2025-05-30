from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="SynthesisTalk Backend",
    description="FastAPI backend for the SynthesisTalk research assistant",
    version="0.1.0",
)

class HealthResponse(BaseModel):
    status: str

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Simple health check endpoint.
    """
    return HealthResponse(status="ok")
