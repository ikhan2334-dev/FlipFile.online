backend/
├── src/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── files.py
│   │   │   ├── pdf.py
│   │   │   ├── payments.py
│   │   │   └── health.py
│   │   └── middleware/
│   │       ├── authentication.py
│   │       ├── rate_limiting.py
│   │       └── security.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── cache.py
│   ├── services/
│   │   ├── file_service.py
│   │   ├── pdf_service.py
│   │   ├── auth_service.py
│   │   ├── payment_service.py
│   │   └── virus_scan_service.py
│   ├── models/
│   │   ├── user.py
│   │   ├── file.py
│   │   └── transaction.py
│   ├── utils/
│   │   ├── file_utils.py
│   │   ├── security_utils.py
│   │   └── validators.py
│   └── workers/
│       ├── file_cleanup.py
│       ├── pdf_processor.py
│       └── notification_worker.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx/
├── scripts/
│   ├── deploy.sh
│   ├── backup.sh
│   └── monitor.sh
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
└── main.py
