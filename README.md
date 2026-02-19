# MLTL Annotate

A white-labeled data annotation platform built on [Label Studio](https://github.com/HumanSignal/label-studio) (Apache 2.0).

## Overview

MLTL Annotate is the annotation module of the MLTL AI Interview Platform. It provides a full-featured data labeling interface for text, images, audio, video, and more.

## Deployment

The platform is deployed as a Docker container via GitHub Actions:

```bash
docker pull ghcr.io/yuvraj99776600/label-studio:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  mltl-annotate:
    image: ghcr.io/yuvraj99776600/label-studio:latest
    ports:
      - "8080:8080"
    environment:
      - LABEL_STUDIO_HOST=http://your-domain:8080
      - DJANGO_DB=default
      - POSTGRESHOST=db
      - POSTGRESPORT=5432
      - POSTGRES_DB=label_studio
      - POSTGRES_USER=label_studio
      - POSTGRES_PASSWORD=your-password
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=label_studio
      - POSTGRES_USER=label_studio
      - POSTGRES_PASSWORD=your-password
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

## License

This project is based on Label Studio, licensed under the [Apache License 2.0](LICENSE).