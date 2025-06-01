# Test ChromaDB
try:
    import chromadb
    print("✅ ChromaDB imported successfully")
    
    # Test basic functionality
    client = chromadb.Client()
    collection = client.create_collection("test")
    print("✅ ChromaDB basic operations work")
    
except Exception as e:
    print(f"❌ ChromaDB error: {e}")

# Test ONNX Runtime
try:
    import onnxruntime
    print(f"✅ ONNX Runtime version: {onnxruntime.__version__}")
except Exception as e:
    print(f"❌ ONNX Runtime error: {e}")