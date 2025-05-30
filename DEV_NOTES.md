# DEV_NOTES.md

# Developer Setup & Run

This file covers all the “internal” steps for getting up and running.

## Backend

1. Create & activate a virtual environment:
   ```bash
   python -m venv .venv
   # macOS/Linux
   source .venv/bin/activate
   # Windows PowerShell
   .\.venv\Scripts\Activate
````

2. Install Python deps:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the FastAPI server:

   ```bash
   uvicorn backend:app --reload --host 0.0.0.0 --port 8000
   ```

4. Health-check:

   ```bash
   curl http://localhost:8000/health
   # → {"status":"ok"}
   ```

## LLM Integration Scaffolding

- **New dependency**: `google-cloud-aiplatform>=1.26.0`
- **How to install** (PowerShell):
  ```powershell
  pip install -r requirements.txt

  ### Vertex AI Authentication & Model

1. Copy `.env.sample` to `.env` and fill in:
   - `GOOGLE_APPLICATION_CREDENTIALS`
   - `GCP_PROJECT`
   - `GCP_REGION`
   - `VERTEX_AI_MODEL_ID`

2. Install/update deps:
   ```powershell
   pip install -r requirements.txt


### Document Upload & Extraction

1.  **New dependency**: `PyPDF2>=3.0.0`
2.  **How to install** (PowerShell):
    ```powershell
    Add-Content -Path requirements.txt -Value 'PyPDF2>=3.0.0'
    pip install -r requirements.txt
    ```
3.  **Backend endpoint**: Implement `/api/documents` in `backend/main.py` to handle file uploads and extract text from PDFs or plain text files.