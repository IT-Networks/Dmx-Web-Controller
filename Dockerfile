FROM python:3.11-slim

# Arbeitsverzeichnis
WORKDIR /app

# System-Dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python-Dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Backend kopieren
COPY backend/ /app/backend/

# Frontend kopieren
COPY frontend/ /app/frontend/

# Static files als /static mounten
RUN ln -s /app/frontend /app/static

# Data-Verzeichnis für Volumes
RUN mkdir -p /data

# Port freigeben
EXPOSE 8000

# Health Check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/devices')" || exit 1

# Start Command
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
