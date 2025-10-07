#!/bin/bash
# ML Service Startup Script

echo "🔧 Setting up Python ML Service..."

# Install dependencies if not already installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    pip install --user -r requirements.txt
fi

echo "🚀 Starting ML Service on port 8000..."
cd "$(dirname "$0")"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
