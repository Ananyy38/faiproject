import os
import io
from typing import List, Dict
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
class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class LLMRequest(BaseModel):
    prompt: str
    conversation_id: str = "default"
    context: List[Message] = []

class LLMResponse(BaseModel):
    response: str
    conversation_id: str
    updated_context: List[Message]

class DocumentResponse(BaseModel):
    filename: str
    text: str

# --- In-memory conversation storage ---
conversations: Dict[str, List[Message]] = {}

# --- Actual LLMTool implementation ---
class LLMTool:
    def __init__(self):
        self.client = groq_client
    
    def call(self, prompt: str, context: List[Message] = None) -> str:
        try:
            # Build messages array with context
            messages = []
            
            # Add system message for research assistant behavior
            messages.append({
                "role": "system",
                "content": "You are SynthesisTalk, an intelligent research assistant. You help users explore complex topics through conversation. Maintain context from previous messages and provide thoughtful, well-reasoned responses. If you reference previous parts of the conversation, be explicit about what you're referring to."
            })
            
            # Add conversation context
            if context:
                for msg in context:
                    messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
            
            # Add current prompt
            messages.append({
                "role": "user",
                "content": prompt
            })
            
            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model="llama3-8b-8192",
                temperature=0.7,
                max_tokens=1000
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

# --- Helper functions ---
def get_conversation_context(conversation_id: str, max_messages: int = 10) -> List[Message]:
    """Get the last N messages from a conversation for context"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    # Return last max_messages (keep recent context manageable)
    return conversations[conversation_id][-max_messages:]

def update_conversation(conversation_id: str, user_message: str, assistant_response: str):
    """Add new messages to conversation history"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []
    
    conversations[conversation_id].extend([
        Message(role="user", content=user_message),
        Message(role="assistant", content=assistant_response)
    ])

# --- Health check endpoint ---
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SynthesisTalk Backend"}

# --- LLM endpoint with context ---
@app.post("/api/llm", response_model=LLMResponse)
async def llm_endpoint(req: LLMRequest):
    try:
        # Get conversation context
        context = get_conversation_context(req.conversation_id)
        
        # Override with provided context if given
        if req.context:
            context = req.context
        
        # Call LLM with context
        tool = LLMTool()
        answer = tool.call(req.prompt, context)
        
        # Update conversation history
        update_conversation(req.conversation_id, req.prompt, answer)
        
        # Get updated context to return
        updated_context = get_conversation_context(req.conversation_id)
        
        return LLMResponse(
            response=answer,
            conversation_id=req.conversation_id,
            updated_context=updated_context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Get conversation history ---
@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get full conversation history"""
    context = get_conversation_context(conversation_id, max_messages=50)  # Get more for full history
    return {
        "conversation_id": conversation_id,
        "messages": context,
        "message_count": len(context)
    }

# --- Clear conversation ---
@app.delete("/api/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str):
    """Clear conversation history"""
    if conversation_id in conversations:
        del conversations[conversation_id]
    return {"message": f"Conversation {conversation_id} cleared"}

# --- List all conversations ---
@app.get("/api/conversations")
async def list_conversations():
    """Get list of all conversation IDs and their message counts"""
    return {
        "conversations": [
            {
                "id": conv_id,
                "message_count": len(messages),
                "last_message": messages[-1].content[:100] + "..." if messages else "No messages"
            }
            for conv_id, messages in conversations.items()
        ]
    }

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