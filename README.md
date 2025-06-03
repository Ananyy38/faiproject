# SynthesisTalk

**Intelligent Conversations with Advanced Reasoning and Search**

SynthesisTalk is an LLM-powered research assistant that lets users upload documents (PDFs), run advanced reasoning (chain-of-thought), integrate live web search results via Brave Search, and generate structured summaries—all within a conversational chat interface. It maintains context across turns, extracts and synthesizes information from multiple sources, and lets you export findings for further use.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the App Locally](#running-the-app-locally)
4. [High-Level Architecture](#high-level-architecture)
5. [Key Features](#key-features)
6. [Directory Structure](#directory-structure)
7. [Environment Variables](#environment-variables)
8. [Contributing](#contributing)

---

## Prerequisites

Before getting started, make sure you have the following installed on your machine:

* **Node.js** (version 14.x or later) and **npm**
* **Python 3.9+** (for the backend)
* A code editor or IDE of your choice (e.g., VS Code)
* A terminal or command-line interface
* **Git** (to clone the repository)

### Python Packages

The backend depends on these main Python libraries (listed here for reference; see [requirements.txt](#requirements-txt) below):

* fastapi
* uvicorn
* pydantic
* python-dotenv
* pypdf
* python-multipart
* sqlalchemy
* requests

#### `requirements.txt`

```txt
fastapi
uvicorn
pydantic
python-dotenv
pypdf
python-multipart
sqlalchemy
requests
```

(Place this file at the project root. Installing with `pip install -r requirements.txt` will pull in all needed packages.)

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Ananyy38/faiproject.git
   cd faiproject
   ```

2. **Set up the Python backend**

   * Create a virtual environment and activate it:

     ```bash
     python3 -m venv .venv
     source .venv/bin/activate   # (on Windows: .venv\Scripts\activate)
     ```
   * Install Python dependencies:

     ```bash
     pip install -r requirements.txt
     ```

3. **Set up the React frontend**

   * (At the project root, where `package.json` lives)

     ```bash
     npm install
     ```

4. **Create (or update) your `.env` file**
   At the project root, copy `.env.example` (if provided) to `.env` and fill in the required variables (see [Environment Variables](#environment-variables)).

---

## Running the App Locally

1. **Start the backend server**
   From the project root (with your Python virtual environment activated):

   ```bash
   uvicorn backend.main:app --reload
   ```

   By default, FastAPI will run on **[http://localhost:8000](http://localhost:8000)**.

2. **Start the frontend development server**
   In a separate terminal window (from the project root):

   ```bash
   npm run dev
   ```

   This launches the React app on **[http://localhost:3000](http://localhost:3000)**.

3. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000). You should see the SynthesisTalk chat interface.

> **Note:** The backend auto-initializes its SQLite (or configured) database on startup—no manual migration steps are needed.

---

## High-Level Architecture

```
┌─────────────────────────────┐
│       Frontend (React)      │
│  - ChatInterface.jsx        │
│  - ChatAndHistory.jsx       │
│  - App.jsx (state, routing) │
└───────────┬─────────────────┘
            │ HTTP / WebSocket
            ▼
┌──────────────────────────────────────────┐
│       Backend (FastAPI)                 │
│  ┌──────────────────────────────────┐    │
│  │  main.py (API routes & startup)  │    │
│  │  models.py (Pydantic & SQLAlchemy)│   │
│  │  services.py (business logic)    │    │
│  │  database.py (DB initialization) │    │
│  └──────────────────────────────────┘    │
│              │                           │
│              │  ┌────────────────────────┐│
│              ├─▶│ LLM & Tool Integration ││
│              │  │ - Grok API calls       ││
│              │  │ - Brave Search API     ││
│              │  └────────────────────────┘│
│              ▼                           │
│    Local SQLite (auto-created)           │
└──────────────────────────────────────────┘
```

1. **Frontend (React)**

   * Renders a chat interface (`ChatInterface.jsx`) where users type queries or upload PDFs.
   * Maintains conversation history in a sidebar component (`ChatAndHistory.jsx`).
   * Communicates with the FastAPI backend over HTTP (REST endpoints) or WebSocket (for streaming responses).

2. **Backend (FastAPI)**

   * **`main.py`**: Defines API routes (e.g., `/chat`, `/upload`, `/export`), configures middleware, and starts the server.
   * **`models.py`**: Declares Pydantic models (request/response schemas) and SQLAlchemy ORM models for persisting conversation state.
   * **`services.py`**: Houses core business logic—document parsing (via PyPDF), chaining reasoning steps, querying Brave Search, calling Grok API, and formatting results.
   * **`database.py`**: Sets up the SQLAlchemy engine (using an SQLite file by default), session, and ensures tables are created at startup.

3. **LLM & Tool Integration**

   * **GROK\_API\_KEY**: Authenticates to Grok for advanced reasoning and summarization.
   * **BRAVE\_API\_KEY**: Enables Brave Search queries to augment responses with live web results.
   * Document parsing happens via **PyPDF**, then text is chunked and passed to the Grok API for chain-of-thought reasoning.
   * Search results are fetched from Brave, then combined/synthesized with in-memory context.

4. **Database**

   * A local SQLite file (e.g., `synthesis.db`) stores conversation histories, uploaded-file metadata, and any indexing needed for analytics.
   * SQLAlchemy automates table creation on app startup.

---

## Key Features

* **Contextual Research Conversation**

  * Maintain multi-turn context across user questions, document uploads, and search queries.
  * Sidebar displays full conversation history.

* **Document Analysis & Summarization**

  * Upload PDFs: text is extracted via `pypdf`, then chunked for summary.
  * Chain-of-Thought Reasoning: each uploaded document can be queried for deep insights, using Grok’s API to show intermediate reasoning steps.
  * Inline citations of page numbers.

* **Live Web Search Integration**

  * Use Brave Search API to fetch up-to-date facts or verify information.
  * Merge search results into the conversation seamlessly.

* **Flexible Output Generation**

  * Generate structured summaries in JSON or plain text.
  * Export an entire chat (including reasoning chains and source citations) as a downloadable document (e.g., TXT or PDF).

* **Tool-Enhanced Experience**

  * Document upload tool (extract, index, annotate).
  * Web search tool (fetch, rank, present results).
  * Note-taking (auto-save key insights to the DB).
  * Explanation tool (request deeper clarification or analogies).

---

## Directory Structure

```
faiproject/
├── backend/
│   ├── main.py                 # FastAPI app and API routes
│   ├── models.py               # Pydantic schemas & SQLAlchemy models
│   ├── services.py             # Business logic (DB calls, LLM/tool orchestration)
│   └── database.py             # Database setup (SQLite + SQLAlchemy)
│
├── src/                        # React frontend
│   ├── components/
│   │   ├── ChatInterface.jsx   # Chat UI components and messaging logic
│   │   └── ChatAndHistory.jsx  # Conversation history/sidebar component
│   ├── index.jsx               # React entry point
│   └── App.jsx                 # Main App (routing & global state)
│
├── .env                        # Environment variables (backend)
├── package.json                # React project config & dependencies
├── requirements.txt            # Python (FastAPI) dependencies
├── README.md                   # Project documentation (you’re here)
└── .gitignore                  # Ignore .env, node_modules/, __pycache__/, etc.
```

---

## Environment Variables

Create a file named `.env` in the project root. At minimum, you must define:

```dotenv
# Grok LLM API key (for advanced reasoning/summarization)
GROK_API_KEY=your_grok_api_key_here

# Brave Search API key (for live web results)
BRAVE_API_KEY=your_brave_api_key_here

# (Optional) If you customize the database URL:
# DATABASE_URL=sqlite:///./synthesis.db
```

* **GROK\_API\_KEY**
  Used by `services.py` to authenticate calls to Grok’s LLM endpoint.

* **BRAVE\_API\_KEY**
  Used by `services.py` to query Brave Search for up-to-date information.

> **Tip:** Never commit `.env` to Git. It’s already included in `.gitignore`.

---

## Contributing

Currently, this project is maintained solo.
