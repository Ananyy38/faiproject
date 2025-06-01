import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.dialects.postgresql import UUID
import uuid

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./synthesistalk.db")

# Create engine
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==================== DATABASE MODELS ====================

class DBConversation(Base):
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=True)  # For UI display
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to messages
    messages = relationship("DBMessage", back_populates="conversation", cascade="all, delete-orphan")

class DBMessage(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    sources = Column(JSON, nullable=True)  # List of sources
    reasoning_steps = Column(JSON, nullable=True)  # List of reasoning steps
    
    # Relationship to conversation
    conversation = relationship("DBConversation", back_populates="messages")

class DBDocument(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    upload_time = Column(DateTime, default=datetime.utcnow)
    content_length = Column(Integer, nullable=False)
    chunks = Column(JSON, nullable=True)  # Document chunks if enabled

# ==================== DATABASE FUNCTIONS ====================

def get_db() -> Session:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified")

# ==================== CONVERSATION CRUD OPERATIONS ====================

def create_conversation(db: Session, conversation_id: str = None, title: str = None) -> DBConversation:
    """Create a new conversation"""
    if not conversation_id:
        conversation_id = f"conversation_{int(datetime.now().timestamp() * 1000)}"
    
    db_conversation = DBConversation(
        id=conversation_id,
        title=title or f"Conversation {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation

def get_conversation(db: Session, conversation_id: str) -> DBConversation:
    """Get a conversation by ID"""
    return db.query(DBConversation).filter(DBConversation.id == conversation_id).first()

def get_conversations(db: Session, skip: int = 0, limit: int = 100) -> list[DBConversation]:
    """Get all conversations"""
    return db.query(DBConversation).offset(skip).limit(limit).all()

def delete_conversation(db: Session, conversation_id: str) -> bool:
    """Delete a conversation and all its messages"""
    conversation = get_conversation(db, conversation_id)
    if conversation:
        db.delete(conversation)
        db.commit()
        return True
    return False

def update_conversation_title(db: Session, conversation_id: str, title: str) -> DBConversation:
    """Update conversation title"""
    conversation = get_conversation(db, conversation_id)
    if conversation:
        conversation.title = title
        conversation.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(conversation)
    return conversation

# ==================== MESSAGE CRUD OPERATIONS ====================

def add_message(db: Session, conversation_id: str, role: str, content: str, 
                sources: list = None, reasoning_steps: list = None) -> DBMessage:
    """Add a message to a conversation"""
    # Ensure conversation exists
    conversation = get_conversation(db, conversation_id)
    if not conversation:
        conversation = create_conversation(db, conversation_id)
    
    db_message = DBMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        sources=sources or [],
        reasoning_steps=reasoning_steps or []
    )
    db.add(db_message)
    
    # Update conversation timestamp
    conversation.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_message)
    return db_message

def get_conversation_messages(db: Session, conversation_id: str) -> list[DBMessage]:
    """Get all messages for a conversation"""
    return db.query(DBMessage).filter(
        DBMessage.conversation_id == conversation_id
    ).order_by(DBMessage.timestamp).all()

# ==================== DOCUMENT CRUD OPERATIONS ====================

def create_document(db: Session, filename: str, content: str, chunks: list = None) -> DBDocument:
    """Create a new document record"""
    document_id = f"doc_{int(datetime.now().timestamp() * 1000)}"
    
    db_document = DBDocument(
        id=document_id,
        filename=filename,
        content=content,
        content_length=len(content),
        chunks=chunks
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def get_document(db: Session, document_id: str) -> DBDocument:
    """Get a document by ID"""
    return db.query(DBDocument).filter(DBDocument.id == document_id).first()

def get_documents(db: Session, skip: int = 0, limit: int = 100) -> list[DBDocument]:
    """Get all documents"""
    return db.query(DBDocument).offset(skip).limit(limit).all()

def delete_document(db: Session, document_id: str) -> bool:
    """Delete a document"""
    document = get_document(db, document_id)
    if document:
        db.delete(document)
        db.commit()
        return True
    return False

# ==================== UTILITY FUNCTIONS ====================

def conversation_to_dict(conversation: DBConversation) -> dict:
    """Convert conversation model to dictionary"""
    return {
        "conversation_id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "message_count": len(conversation.messages)
    }

def message_to_dict(message: DBMessage) -> dict:
    """Convert message model to dictionary"""
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "timestamp": message.timestamp.isoformat(),
        "sources": message.sources or [],
        "reasoning_steps": message.reasoning_steps or []
    }

def document_to_dict(document: DBDocument) -> dict:
    """Convert document model to dictionary"""
    return {
        "document_id": document.id,
        "filename": document.filename,
        "content": document.content,
        "upload_time": document.upload_time.isoformat(),
        "content_length": document.content_length,
        "chunks": document.chunks
    }

# ==================== MIGRATION FUNCTIONS ====================

def migrate_in_memory_data(conversations_dict: dict, documents_dict: dict):
    """Migrate existing in-memory data to database"""
    db = SessionLocal()
    try:
        print("🔄 Migrating in-memory data to database...")
        
        # Migrate conversations and messages
        for conv_id, messages in conversations_dict.items():
            if not get_conversation(db, conv_id):
                # Create conversation
                create_conversation(db, conv_id)
                
                # Add messages
                for msg in messages:
                    add_message(
                        db, conv_id, msg.role, msg.content,
                        msg.sources, msg.reasoning_steps
                    )
        
        # Migrate documents
        for doc_id, doc_context in documents_dict.items():
            if not get_document(db, doc_id):
                db_document = DBDocument(
                    id=doc_id,
                    filename=doc_context.filename,
                    content=doc_context.content,
                    upload_time=datetime.fromisoformat(doc_context.upload_time),
                    content_length=doc_context.content_length,
                    chunks=[chunk.__dict__ for chunk in doc_context.chunks] if doc_context.chunks else None
                )
                db.add(db_document)
        
        db.commit()
        print(f"✅ Migrated {len(conversations_dict)} conversations and {len(documents_dict)} documents")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()