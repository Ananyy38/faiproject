import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google.cloud import aiplatform

# Load env vars from .env
load_dotenv()

# Initialize FastAPI
app = FastAPI(…)

# LLM tool with real Vertex AI client & model
class LLMTool:
    def __init__(self):
        # Read from env
        project = os.getenv("GCP_PROJECT")
        region = os.getenv("GCP_REGION")
        model_id = os.getenv("VERTEX_AI_MODEL_ID")
        if not all([project, region, model_id]):
            raise ValueError("Missing one of GCP_PROJECT, GCP_REGION, VERTEX_AI_MODEL_ID")
        # Initialize client
        aiplatform.init(project=project, location=region)
        # Load the deployed model
        self.endpoint = aiplatform.PredictionEndpoint(model=model_id)

    def call(self, prompt: str) -> str:
        prediction = self.endpoint.predict(instances=[{"content": prompt}])
        # Assuming the model returns {"content": "..."}
        return prediction.predictions[0].get("content", "")

# Request/response schemas remain the same…

@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        tool = LLMTool()
        answer = tool.call(req.prompt)
        return LLMResponse(response=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
