# services.py

import os
import io
import json
import hashlib
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from groq import Groq
from PyPDF2 import PdfReader
from fastapi import UploadFile, HTTPException

# Import models (assuming they're in models.py)
from models import (
    Message, SearchResult, DocumentChunk, DocumentContext,
    ReasoningStep, LLMRequest, LLMResponse, DocumentResponse
)

# ==================== GLOBAL STATE STORAGE ====================

# In-memory storage for conversations
conversations: Dict[str, List[Message]] = {}

# In-memory storage for document contexts
document_contexts: Dict[str, DocumentContext] = {}

# In-memory cache for search results
search_cache: Dict[str, Tuple[List[SearchResult], datetime]] = {}

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")

if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
else:
    groq_client = None

# ==================== CONVERSATION MANAGEMENT ====================

def get_conversation_context(conversation_id: str) -> List[Message]:
    """Get conversation context for a given conversation ID"""
    return conversations.get(conversation_id, [])

def update_conversation(
    conversation_id: str,
    user_message: str,
    assistant_response: str,
    sources: List[str] = None,
    reasoning_steps: List[ReasoningStep] = None
):
    """Update conversation with new messages"""
    if conversation_id not in conversations:
        conversations[conversation_id] = []

    # Add user message
    conversations[conversation_id].append(Message(
        role="user",
        content=user_message,
        timestamp=datetime.now().isoformat(),
        sources=None,
        reasoning_steps=None
    ))

    # Add assistant message
    conversations[conversation_id].append(Message(
        role="assistant",
        content=assistant_response,
        timestamp=datetime.now().isoformat(),
        sources=sources or [],
        reasoning_steps=reasoning_steps or []
    ))

# ==================== DOCUMENT PROCESSING ====================

async def process_document(
    file: UploadFile,
    enable_chunking: bool = True,
    chunk_size: int = 2000
) -> DocumentResponse:
    """Process uploaded document and store in context"""
    try:
        # Read file content
        content = await file.read()

        # Extract text based on file type
        if file.filename.lower().endswith('.pdf'):
            text_content = extract_pdf_text(content)
        elif file.filename.lower().endswith('.txt'):
            text_content = content.decode('utf-8')
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Only PDF and TXT files are supported."
            )

        if not text_content.strip():
            raise HTTPException(
                status_code=400,
                detail="No text content found in the document"
            )

        # Generate document ID
        doc_id = hashlib.md5(
            f"{file.filename}_{datetime.now().isoformat()}".encode()
        ).hexdigest()[:12]

        # Create chunks if enabled
        chunks = None
        if enable_chunking:
            chunks = chunk_text(text_content, chunk_size)

        # Create document context
        doc_context = DocumentContext(
            filename=file.filename,
            content=text_content,
            upload_time=datetime.now().isoformat(),
            content_length=len(text_content),
            chunks=chunks
        )

        # Store in global context
        document_contexts[doc_id] = doc_context

        return DocumentResponse(
            document_id=doc_id,
            filename=file.filename,
            content_length=len(text_content),
            chunks_created=len(chunks) if chunks else 0,
            message=f"Document '{file.filename}' uploaded and processed successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process document: {str(e)}"
        )

# ==================== CHAIN OF THOUGHT REASONING SYSTEM ====================

class ChainOfThoughtReasoner:
    """Implements Chain of Thought reasoning for complex queries"""

    def __init__(self, llm_client, search_tool=None):
        self.llm_client = llm_client
        self.search_tool = search_tool

    def analyze_query_complexity(self, query: str) -> Dict[str, any]:
        """Analyze if query needs multi-step reasoning"""
        complexity_indicators = [
            "compare", "analyze", "explain why", "what causes", "how does",
            "relationship between", "impact of", "differences", "similarities",
            "pros and cons", "advantages", "disadvantages", "evaluate",
            "synthesize", "summarize", "research", "investigate"
        ]
        query_lower = query.lower()
        complexity_score = sum(1 for ind in complexity_indicators if ind in query_lower)
        needs_search = any(term in query_lower for term in [
            "recent", "current", "latest", "new", "today", "2024", "2025", "now"
        ])
        needs_analysis = any(term in query_lower for term in [
            "analyze", "compare", "evaluate", "synthesize", "explain"
        ])
        return {
            "complexity_score": complexity_score,
            "needs_multi_step": complexity_score >= 2,
            "needs_search": needs_search,
            "needs_analysis": needs_analysis,
            "query_type": self.classify_query_type(query_lower)
        }

    def classify_query_type(self, query: str) -> str:
        """Classify the type of query for appropriate reasoning"""
        if any(word in query for word in ["compare", "vs", "versus", "difference"]):
            return "comparison"
        elif any(word in query for word in ["analyze", "analysis", "examine"]):
            return "analysis"
        elif any(word in query for word in ["explain", "why", "how", "what causes"]):
            return "explanation"
        elif any(word in query for word in ["synthesize", "combine", "integrate"]):
            return "synthesis"
        elif any(word in query for word in ["research", "investigate", "find out"]):
            return "research"
        else:
            return "general"

    def generate_reasoning_plan(
        self,
        query: str,
        context: List[Message],
        document_context: str = None,
        max_steps: int = 3
    ) -> List[Dict]:
        """Generate a step-by-step reasoning plan (now respecting max_steps dynamically)"""
        analysis = self.analyze_query_complexity(query)
        query_type = analysis["query_type"]

        if query_type == "comparison":
            base_plan = [
                {"step": 1, "action": "identify", "description": "Identify the subjects to compare"},
                {"step": 2, "action": "analyze",  "description": "Analyze each subject individually"},
                {"step": 3, "action": "compare",  "description": "Compare and contrast the subjects"},
                {"step": 4, "action": "conclude", "description": "Draw conclusions from the comparison"}
            ]
        elif query_type == "analysis":
            base_plan = [
                {"step": 1, "action": "break_down", "description": "Break down the topic into components"},
                {"step": 2, "action": "examine",    "description": "Examine each component in detail"},
                {"step": 3, "action": "synthesize", "description": "Synthesize findings into insights"}
            ]
        elif query_type == "explanation":
            base_plan = [
                {"step": 1, "action": "understand", "description": "Understand the core question"},
                {"step": 2, "action": "research",   "description": "Gather relevant information"},
                {"step": 3, "action": "explain",    "description": "Provide clear explanation with examples"}
            ]
        elif query_type == "research":
            base_plan = [
                {"step": 1, "action": "search",    "description": "Search for current information"},
                {"step": 2, "action": "analyze",   "description": "Analyze and verify information"},
                {"step": 3, "action": "summarize", "description": "Summarize key findings"}
            ]
        else:  # general
            base_plan = [
                {"step": 1, "action": "understand", "description": "Understand the question"},
                {"step": 2, "action": "process",    "description": "Process available information"},
                {"step": 3, "action": "respond",    "description": "Formulate comprehensive response"}
            ]

        if max_steps <= len(base_plan):
            return base_plan[:max_steps]

        plan = base_plan.copy()
        current_len = len(plan)
        next_step_num = current_len + 1

        while current_len < max_steps:
            plan.append({
                "step": next_step_num,
                "action": "expand",
                "description": f"Perform additional analysis (step {next_step_num})"
            })
            current_len += 1
            next_step_num += 1

        return plan[:max_steps]

    def execute_reasoning_step(
        self,
        step_plan: Dict,
        query: str,
        context: List[Message],
        document_context: str = None,
        search_results: List[SearchResult] = None
    ) -> ReasoningStep:
        """Execute a single reasoning step"""
        step_number = step_plan["step"]
        action = step_plan["action"]
        description = step_plan["description"]

        # Build context for this step
        step_context = f"""
You are working on step {step_number} of a multi-step reasoning process.

Original Query: {query}
Current Step: {description}
Action: {action}

Instructions for this step:
"""
        if action == "identify":
            step_context += "Identify the key subjects, concepts, or elements mentioned in the query."
        elif action == "analyze":
            step_context += "Analyze the identified elements in detail, considering their properties and characteristics."
        elif action == "compare":
            step_context += "Compare and contrast the analyzed elements, highlighting similarities and differences."
        elif action == "break_down":
            step_context += "Break down the topic into its main components or aspects."
        elif action == "examine":
            step_context += "Examine each component in detail, using available information sources."
        elif action == "synthesize":
            step_context += "Synthesize the examined information into coherent insights."
        elif action == "understand":
            step_context += "Understand and clarify what exactly is being asked."
        elif action == "research":
            step_context += "Research and gather relevant information from available sources."
        elif action == "search":
            step_context += "Focus on searching for current, relevant information."
        elif action == "explain":
            step_context += "Provide a clear, detailed explanation with examples if possible."
        elif action == "conclude":
            step_context += "Draw final conclusions based on all previous analysis."
        elif action == "summarize":
            step_context += "Summarize the key findings and insights."
        else:
            step_context += "Process the information and work toward a comprehensive response."

        if document_context:
            step_context += f"\n\nDocument Content Available:\n{document_context[:1000]}..."
        if search_results:
            step_context += f"\n\nWeb Search Results Available:\n"
            for i, result in enumerate(search_results[:3], 1):
                step_context += f"{i}. {result.title}: {result.description}\n"
        step_context += f"\n\nProvide your analysis for this step only. Be specific and detailed."

        try:
            messages = [
                {"role": "system", "content": "You are an expert research assistant performing step-by-step reasoning."},
                {"role": "user",   "content": step_context}
            ]
            response = self.llm_client.chat.completions.create(
                messages=messages,
                model="llama3-8b-8192",
                temperature=0.3,
                max_tokens=500
            )
            step_content = response.choices[0].message.content

            sources_used = []
            if document_context and any(word in step_content.lower() for word in ["document", "text", "content"]):
                sources_used.append("Document content")
            if search_results and any(word in step_content.lower() for word in ["search", "web", "recent"]):
                sources_used.append("Web search results")
            if not sources_used:
                sources_used.append("Knowledge base")

            return ReasoningStep(
                step_number=step_number,
                description=description,
                action=action,
                content=step_content,
                sources_used=sources_used
            )

        except Exception as e:
            return ReasoningStep(
                step_number=step_number,
                description=description,
                action=action,
                content=f"Error in reasoning step: {str(e)}",
                sources_used=["Error"]
            )

    def synthesize_final_response(
        self,
        query: str,
        reasoning_steps: List[ReasoningStep],
        context: List[Message]
    ) -> str:
        """Synthesize all reasoning steps into final response"""
        synthesis_prompt = f"""
Based on the step-by-step reasoning below, provide a comprehensive final answer to the original query.

Original Query: {query}

Reasoning Steps:
"""
        for step in reasoning_steps:
            synthesis_prompt += f"""
Step {step.step_number} ({step.action}): {step.description}
Analysis: {step.content}
Sources: {', '.join(step.sources_used)}
---
"""
        synthesis_prompt += """
Now provide a comprehensive, well-structured final answer that incorporates insights from all reasoning steps.
Make sure to:
1. Directly answer the original query
2. Reference key insights from your step-by-step analysis
3. Maintain logical flow and coherence
4. Include relevant examples or evidence where appropriate
"""

        try:
            messages = [
                {"role": "system", "content": "You are synthesizing multi-step reasoning into a comprehensive response."},
                {"role": "user",   "content": synthesis_prompt}
            ]
            response = self.llm_client.chat.completions.create(
                messages=messages,
                model="llama3-8b-8192",
                temperature=0.5,
                max_tokens=800
            )
            return response.choices[0].message.content

        except Exception as e:
            return f"Error synthesizing response: {str(e)}"

# ==================== SUMMARY GENERATION SYSTEM ====================

class SummaryGenerator:
    """Generate structured summaries in multiple formats"""

    def __init__(self):
        self.llm_client = groq_client

    def generate_bullet_summary(self, conversation_messages: List[Message]) -> str:
        """Generate bullet-point summary"""
        content = self._extract_conversation_content(conversation_messages)
        prompt = f"""
Based on the research conversation below, create a structured bullet-point summary:

{content}

Format your response as:
# Research Summary

## Key Findings
• [Finding 1]
• [Finding 2]
• [Finding 3]

## Main Topics Discussed
• [Topic 1]: [Brief description]
• [Topic 2]: [Brief description]

## Sources Referenced
• [Source 1]
• [Source 2]

## Action Items/Next Steps
• [Item 1]
• [Item 2]
"""
        return self._generate_summary(prompt)

    def generate_executive_summary(self, conversation_messages: List[Message]) -> str:
        """Generate executive summary format"""
        content = self._extract_conversation_content(conversation_messages)
        prompt = f"""
Based on the research conversation below, create an executive summary:

{content}

Format your response as a professional executive summary with:
1. Brief overview paragraph
2. Key insights and findings
3. Implications and recommendations
4. Supporting evidence summary

Keep it concise but comprehensive (300-500 words).
"""
        return self._generate_summary(prompt)

    def generate_academic_summary(self, conversation_messages: List[Message]) -> str:
        """Generate academic-style summary"""
        content = self._extract_conversation_content(conversation_messages)
        prompt = f"""
Based on the research conversation below, create an academic-style summary:

{content}

Format your response with:
# Abstract
[Brief abstract of the research discussion]

# Introduction
[Context and background]

# Key Findings
[Detailed findings with evidence]

# Discussion
[Analysis and implications]

# Conclusion
[Summary and future directions]

# References
[Sources mentioned in the conversation]

Use formal academic language and structure.
"""
        return self._generate_summary(prompt)

    def _extract_conversation_content(self, messages: List[Message]) -> str:
        """Extract relevant content from conversation messages"""
        content = ""
        for msg in messages:
            role_prefix = "Human" if msg.role == "user" else "Assistant"
            content += f"\n{role_prefix}: {msg.content}\n"
            if msg.sources:
                content += f"Sources: {', '.join(msg.sources)}\n"
        return content

    def _generate_summary(self, prompt: str) -> str:
        """Generate summary using LLM"""
        try:
            response = self.llm_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a professional research summarizer. Create clear, structured summaries."},
                    {"role": "user",   "content": prompt}
                ],
                model="llama3-8b-8192",
                temperature=0.3,
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error generating summary: {str(e)}"

# ==================== VISUALIZATION GENERATOR ====================

class VisualizationGenerator:
    """Generate simple visualizations based on research findings"""

    def __init__(self):
        self.llm_client = groq_client

    def generate_concept_map_data(self, conversation_messages: List[Message]) -> Dict:
        """Generate data for a concept map visualization"""
        content = self._extract_conversation_content(conversation_messages)
        prompt = f"""
Based on the research conversation below, identify key concepts and their relationships:

{content}

Return a JSON structure with:
{{
  "nodes": [
    {{"id": "concept1", "label": "Concept Name", "category": "main|supporting|detail"}},
    {{"id": "concept2", "label": "Another Concept", "category": "main|supporting|detail"}}
  ],
  "links": [
    {{"source": "concept1", "target": "concept2", "relationship": "causes|relates_to|supports|contradicts"}}
  ]
}}

Focus on the 8-12 most important concepts and their key relationships.
"""
        try:
            response = self.llm_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a data analyst creating structured concept maps. Return only valid JSON."},
                    {"role": "user",   "content": prompt}
                ],
                model="llama3-8b-8192",
                temperature=0.2,
                max_tokens=800
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            return {"error": f"Failed to generate concept map: {str(e)}"}

    def generate_timeline_data(self, conversation_messages: List[Message]) -> Dict:
        """Generate timeline visualization data"""
        content = self._extract_conversation_content(conversation_messages)
        prompt = f"""
Based on the research conversation below, identify any temporal elements (dates, events, sequences):

{content}

Return a JSON structure with:
{{
  "timeline_events": [
    {{"date": "YYYY-MM-DD or YYYY or 'Ancient'", "event": "Event description", "category": "historical|recent|future"}},
    {{"date": "YYYY-MM-DD", "event": "Another event", "category": "historical|recent|future"}}
  ],
  "title": "Timeline Title"
}}

If no clear temporal elements exist, return {{"timeline_events": [], "message": "No temporal data found"}}.
"""
        try:
            response = self.llm_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a data analyst creating timeline visualizations. Return only valid JSON."},
                    {"role": "user",   "content": prompt}
                ],
                model="llama3-8b-8192",
                temperature=0.2,
                max_tokens=600
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            return {"error": f"Failed to generate timeline: {str(e)}"}

    def generate_comparison_chart_data(self, conversation_messages: List[Message]) -> Dict:
        """Generate comparison chart data"""
        content = self._extract_conversation_content(conversation_messages)
        prompt = f"""
Based on the research conversation below, identify any comparisons, pros/cons, or contrasting elements:

{content}

Return a JSON structure with:
{{
  "comparison": {{
    "title": "Comparison Title",
    "items": [
      {{"name": "Item 1", "pros": ["Pro 1", "Pro 2"], "cons": ["Con 1", "Con 2"], "score": 7}},
      {{"name": "Item 2", "pros": ["Pro 1", "Pro 2"], "cons": ["Con 1"], "score": 8}}
    ]
  }}
}}

Score should be 1-10. If no clear comparisons exist, return {{ "comparison": null, "message": "No comparison data found" }}.
"""
        try:
            response = self.llm_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a data analyst creating comparison charts. Return only valid JSON."},
                    {"role": "user",   "content": prompt}
                ],
                model="llama3-8b-8192",
                temperature=0.2,
                max_tokens=600
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            return {"error": f"Failed to generate comparison: {str(e)}"}

    def _extract_conversation_content(self, messages: List[Message]) -> str:
        """Extract relevant content from conversation messages"""
        content = ""
        for msg in messages[-10:]:  # Last 10 messages for context
            role_prefix = "Human" if msg.role == "user" else "Assistant"
            content += f"\n{role_prefix}: {msg.content}\n"
        return content

# ==================== WEB SEARCH TOOL ====================

class WebSearchTool:
    def __init__(self):
        self.api_key = BRAVE_API_KEY
        self.base_url = "https://api.search.brave.com/res/v1/web/search"

    def search(self, query: str, max_results: int = 5, use_cache: bool = True) -> Tuple[List[SearchResult], bool]:
        """Search the web using Brave Search API with caching"""
        if not self.api_key:
            raise Exception("Brave API key not configured")

        # Check cache first
        cache_key = get_cache_key(query, max_results)
        if use_cache and cache_key in search_cache:
            cached_results, cache_time = search_cache[cache_key]
            if is_cache_valid(cache_time):
                return cached_results, True

        try:
            headers = {
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": self.api_key
            }
            params = {
                "q": query,
                "count": max_results,
                "search_lang": "en",
                "country": "us",
                "safesearch": "moderate",
                "freshness": "pm"
            }
            response = requests.get(self.base_url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            results = []

            if "web" in data and "results" in data["web"]:
                for item in data["web"]["results"]:
                    results.append(SearchResult(
                        title=item.get("title", ""),
                        url=item.get("url", ""),
                        description=item.get("description", "")
                    ))

            # Cache the results
            if use_cache:
                search_cache[cache_key] = (results, datetime.now())

            return results, False

        except Exception as e:
            raise Exception(f"Web search failed: {str(e)}")

# ==================== LLM TOOL ====================

class LLMTool:
    def __init__(self):
        self.client = groq_client
        self.search_tool = WebSearchTool() if BRAVE_API_KEY else None
        self.reasoner = ChainOfThoughtReasoner(groq_client, self.search_tool) if groq_client else None

    def call(
        self,
        prompt: str,
        context: List[Message] = None,
        include_search: bool = False,
        document_context: str = None,
        enable_source_attribution: bool = True,
        enable_chain_of_thought: bool = False,
        reasoning_depth: int = 3
    ) -> tuple:

        if not self.client:
            raise Exception("Groq client not initialized - check GROQ_API_KEY")

        try:
            search_results = None
            search_cached = False
            document_used = None
            sources_used = []
            reasoning_steps = []
            metadata = {}

            # Perform web search if requested and available
            if include_search and self.search_tool:
                try:
                    search_results, search_cached = self.search_tool.search(prompt, max_results=3)
                    metadata['search_cached'] = search_cached
                except Exception as e:
                    print(f"Search failed: {e}")

            # Chain of Thought Reasoning
            if enable_chain_of_thought and self.reasoner:
                reasoning_plan = self.reasoner.generate_reasoning_plan(
                    prompt, context or [], document_context, reasoning_depth
                )
                for step_plan in reasoning_plan:
                    reasoning_step = self.reasoner.execute_reasoning_step(
                        step_plan, prompt, context or [], document_context, search_results
                    )
                    reasoning_steps.append(reasoning_step)
                response_content = self.reasoner.synthesize_final_response(
                    prompt, reasoning_steps, context or []
                )
                metadata['reasoning_enabled'] = True
                metadata['reasoning_steps_count'] = len(reasoning_steps)

            else:
                # Original single-step processing
                messages = []
                system_message = """You are SynthesisTalk, an intelligent research assistant. You help users explore complex topics through conversation. Maintain context from previous messages and provide thoughtful, well-reasoned responses."""
                if enable_source_attribution:
                    system_message += """
                    
IMPORTANT: When referencing information, clearly indicate your sources:
- For document content, use: [Document: filename]
- For web search results, use: [Web: source title]
- For your training knowledge, use: [Knowledge Base]
"""
                if document_context:
                    document_used = "Document content integrated"
                    system_message += f"\n\nYou have access to the following document content for reference:\n\n--- DOCUMENT CONTENT ---\n{document_context}\n--- END DOCUMENT ---\n\nUse this document content to provide more informed responses when relevant."
                if search_results:
                    search_context = f"\n\nWeb search results for your reference (Cached: {search_cached}):\n"
                    for i, result in enumerate(search_results, 1):
                        search_context += f"{i}. {result.title}\n   {result.description}\n   Source: {result.url}\n\n"
                    system_message += search_context + "Use these search results to provide more current and comprehensive information when relevant."

                messages.append({"role": "system", "content": system_message})
                if context:
                    for msg in context:
                        messages.append({"role": msg.role, "content": msg.content})
                messages.append({"role": "user", "content": prompt})

                chat_completion = self.client.chat.completions.create(
                    messages=messages,
                    model="llama3-8b-8192",
                    temperature=0.7,
                    max_tokens=1000
                )
                response_content = chat_completion.choices[0].message.content

            # Extract sources if attribution is enabled
            if enable_source_attribution:
                sources_used = self.extract_sources_from_response(
                    response_content, search_results, document_used
                )

            metadata.update({
                'model_used': 'llama3-8b-8192',
                'temperature': 0.7 if not enable_chain_of_thought else 0.3,
                'source_attribution_enabled': enable_source_attribution,
                'chain_of_thought_enabled': enable_chain_of_thought
            })

            return response_content, search_results, document_used, sources_used, metadata, reasoning_steps

        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

    def extract_sources_from_response(
        self,
        response: str,
        search_results: List[SearchResult] = None,
        document_used: str = None
    ) -> List[str]:
        """Extract and categorize sources used in the response"""
        sources = []
        if document_used:
            sources.append(f"Document: {document_used}")
        if search_results:
            response_lower = response.lower()
            for result in search_results:
                title_words = result.title.lower().split()
                if any(word in response_lower for word in title_words if len(word) > 4):
                    sources.append(f"Web: {result.title} ({result.url})")
        if not sources:
            sources.append("LLM Knowledge Base")
        return sources

# ==================== UTILITY FUNCTIONS ====================

def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 200) -> List[DocumentChunk]:
    """
    Split text into non-empty chunks of roughly chunk_size characters, with overlap.
    If a chunk ends before the end of text, attempt to break at the last period/newline
    at or beyond halfway; otherwise cut at chunk_size. After gathering all chunks,
    set total_chunks on each chunk and assign chunk_ids in order.
    """
    # If the entire text is smaller than chunk_size, return as single chunk
    if len(text) <= chunk_size:
        return [
            DocumentChunk(
                chunk_id="chunk_0",
                content=text,
                chunk_index=0,
                total_chunks=1
            )
        ]

    chunks: List[DocumentChunk] = []
    start = 0
    chunk_index = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        # If not at final chunk, try to find a period or newline to break
        if end < len(text):
            last_period = text.rfind('.', start, end)
            last_newline = text.rfind('\n', start, end)
            break_point = max(last_period, last_newline)
            # If break_point is at or beyond halfway, use it
            if break_point >= start + chunk_size // 2:
                end = break_point + 1

        # Extract the chunk and strip whitespace
        chunk_content = text[start:end].strip()
        if chunk_content:
            chunks.append(DocumentChunk(
                chunk_id=f"chunk_{chunk_index}",
                content=chunk_content,
                chunk_index=chunk_index,
                total_chunks=0  # placeholder; will set later
            ))
            chunk_index += 1

        # Compute next start so that chunks overlap by `overlap` characters
        next_start = end - overlap
        # Ensure progress: if subtraction would go backwards, just move to `end`
        if next_start <= start:
            next_start = end
        start = next_start

    # Now set total_chunks for each chunk
    total_chunks = len(chunks)
    for chunk in chunks:
        chunk.total_chunks = total_chunks

    return chunks

def get_cache_key(query: str, max_results: int = 5) -> str:
    """Generate cache key for search queries"""
    return hashlib.md5(f"{query}_{max_results}".encode()).hexdigest()

def is_cache_valid(cache_time: datetime, max_age_hours: int = 24) -> bool:
    """Check if cached search result is still valid"""
    return datetime.now() - cache_time < timedelta(hours=max_age_hours)

def extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF content"""
    reader = PdfReader(io.BytesIO(content))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text
