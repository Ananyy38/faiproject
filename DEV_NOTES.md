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

## Frontend

> *To be filled in once we scaffold React.*


## LLM Integration Scaffolding

- **New dependency**: `google-cloud-aiplatform>=1.26.0`
- **How to install** (PowerShell):
  ```powershell
  pip install -r requirements.txt