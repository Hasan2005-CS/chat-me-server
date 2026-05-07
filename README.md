# chat-me-server

A production-ready backend for a real-time messaging application built with NestJS, inspired by the architecture of modern chat platforms like WhatsApp. The project covers the full lifecycle from local development to a secured cloud deployment.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Future Work](#future-work)

---

## Overview

chat-me-server is a backend system that supports real-time one-to-one and group messaging, multi-provider authentication, file uploads, and push notifications. It is designed with a modular architecture that separates concerns cleanly across features, making it straightforward to extend or maintain.

The system is deployed on a DigitalOcean Droplet, served over HTTPS via Nginx, and ships as a Docker image through an automated CI/CD pipeline backed by GitHub Actions.

---

## Architecture

```
Client (HTTP / WebSocket)
        |
      Nginx (Reverse Proxy + SSL)
        |
   NestJS Application
        |
   ┌────────────────────────────┐
   | Auth | Users | Messages   |
   | Conversations | Upload    |
   | Notifications | Health    |
   └────────────────────────────┘
        |                |
  MongoDB Atlas     Cloudinary
```

The application follows a feature-based module structure. Each module owns its schema, service, controller, and any guards or strategies it needs. Shared concerns such as error handling and logging live in a common layer.

Authentication is built on the Identity Linking pattern: a single user document can hold multiple provider identities (Google, GitHub, local), which means a user who signs up with Google and later logs in with the same email via GitHub will not end up with two separate accounts.

---

## Features

**Authentication**

- Local registration and login with email and password
- OAuth 2.0 via Google and GitHub
- JWT-based access tokens with a 15-minute expiry
- Refresh tokens stored as bcrypt hashes in the database and delivered via httpOnly cookies, which allows proper revocation on logout
- Identity linking across providers on the same email address

**Messaging**

- Real-time one-to-one and group conversations over WebSocket using Socket.io
- JWT authentication on the WebSocket handshake
- Message types: text, image, audio, file
- Reply-to support
- Soft delete

**Message Status**

- Sent, delivered, and read receipts per recipient
- Automatic delivery marking when a user connects
- Automatic read marking when a user opens a conversation

**Notifications**

- Instant in-session notifications delivered over the existing WebSocket connection for online users
- Persistent notifications stored in the database for offline users, retrievable on next login

**File Upload**

- Image upload with type and size validation (5 MB limit)
- General file upload (20 MB limit)
- Files stored on Cloudinary with CDN delivery

**User Search**

- Case-insensitive search across display name and email
- Results exclude the requesting user
- Limited to 10 results per query

**Security**

- Helmet for HTTP security headers
- Rate limiting: 10 requests per second, 100 per minute
- Firewall via ufw, with port 3000 blocked externally
- Docker bound to localhost, traffic routed exclusively through Nginx
- Root SSH login disabled
- Sensitive files restricted to owner read/write (chmod 600)

**Observability**

- Structured application logging
- Health check endpoint covering MongoDB connectivity and heap memory

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Language | TypeScript |
| Database | MongoDB via Mongoose |
| Validation | Zod via nestjs-zod |
| Authentication | Passport.js (Local, Google, GitHub, JWT) |
| Real-time | Socket.io |
| File Storage | Cloudinary |
| Containerization | Docker, Docker Compose |
| Reverse Proxy | Nginx |
| SSL | Let's Encrypt via Certbot |
| CI/CD | GitHub Actions + Docker Hub |
| Hosting | DigitalOcean Droplet |
| Database Hosting | MongoDB Atlas |

---

## Getting Started

**Prerequisites**

- Node.js 22
- Docker and Docker Compose
- A MongoDB instance (local or Atlas)
- A Cloudinary account
- Google and GitHub OAuth credentials

**Local Development**

```bash
git clone https://github.com/Hasan2005-CS/chat-me-server.git
cd chat-me-server
npm install
cp .env.example .env
# fill in the required values in .env
npm run start:dev
```

**With Docker**

```bash
docker compose up --build
```

The server will be available at `http://localhost:3000/api/v1`.

---

## Environment Variables

| Variable | Description |
|---|---|
| PORT | Application port (default: 3000) |
| NODE_ENV | Environment (development / production) |
| MONGODB_URI | MongoDB connection string |
| JWT_SECRET | Secret for signing access tokens |
| JWT_EXPIRES_IN | Access token expiry (e.g. 15m) |
| JWT_REFRESH_SECRET | Secret for signing refresh tokens |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| GOOGLE_CALLBACK_URL | Google OAuth redirect URL |
| GITHUB_CLIENT_ID | GitHub OAuth client ID |
| GITHUB_CLIENT_SECRET | GitHub OAuth client secret |
| GITHUB_CALLBACK_URL | GitHub OAuth redirect URL |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Cloudinary API key |
| CLOUDINARY_API_SECRET | Cloudinary API secret |

---

## API Reference

All endpoints are prefixed with `/api/v1`.

**Auth**

| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Register with email and password |
| POST | /auth/login | Login with email and password |
| POST | /auth/refresh | Refresh access token using cookie |
| POST | /auth/logout | Logout and revoke refresh token |
| GET | /auth/me | Get current user (requires JWT) |
| GET | /auth/google | Initiate Google OAuth flow |
| GET | /auth/github | Initiate GitHub OAuth flow |

**Users**

| Method | Endpoint | Description |
|---|---|---|
| GET | /users/search?q= | Search users by name or email |

**Conversations**

| Method | Endpoint | Description |
|---|---|---|
| POST | /conversations/direct | Create or fetch a direct conversation |
| POST | /conversations/group | Create a group conversation |
| GET | /conversations | List current user's conversations |

**Notifications**

| Method | Endpoint | Description |
|---|---|---|
| GET | /notifications | Get unread notifications |
| GET | /notifications/count | Get unread notification count |
| PATCH | /notifications/:id/read | Mark a notification as read |
| PATCH | /notifications/read-all | Mark all notifications as read |

**Upload**

| Method | Endpoint | Description |
|---|---|---|
| POST | /upload/image | Upload an image (max 5 MB) |
| POST | /upload/file | Upload a file (max 20 MB) |

**Health**

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Check MongoDB and memory status |

**WebSocket**

Connect to `wss://chat-me.app/chat` with the access token in the handshake auth object:

```javascript
const socket = io('wss://chat-me.app/chat', {
  auth: { token: accessToken }
});
```

| Event (emit) | Payload | Description |
|---|---|---|
| send_message | { conversationId, content, type?, replyTo? } | Send a message |
| join_conversation | { conversationId } | Join a conversation room |
| open_conversation | { conversationId } | Mark messages as read |
| mark_read | { messageId } | Mark a single message as read |

| Event (listen) | Description |
|---|---|
| new_message | A new message arrived |
| messages_delivered | Messages were delivered to a user |
| messages_read | Messages were read by a user |
| notification | A real-time notification |

---

## Deployment

The application is deployed at `https://chat-me.app`.

The deployment pipeline works as follows: a push to the main branch triggers a GitHub Actions workflow that builds the project, builds a Docker image, and pushes it to Docker Hub. On the server, the image is pulled and run via Docker Compose behind an Nginx reverse proxy with a Let's Encrypt SSL certificate.

To deploy a new version manually:

```bash
ssh hasan@68.183.211.7
cd ~
docker compose pull
docker compose up -d
```
You can check the docs from here `https://chat-me.app/docs`.
---

## Future Work

Several directions would meaningfully extend this project.

**Push Notifications for Offline Users**

The current notification system stores unread notifications in the database and delivers them on the next WebSocket connection. A proper mobile push notification layer using Firebase Cloud Messaging would allow delivery even when the application is closed.

**End-to-End Encryption**

Messages are currently stored in plaintext in the database. Implementing the Signal Protocol or a similar double-ratchet scheme would ensure that only the communicating parties can read message content.

**Automated Testing**

The project currently has no test suite. Adding unit tests for the authentication and messaging services, and integration tests for the critical API endpoints, would significantly increase confidence in the correctness of the system and make future changes safer.

**Voice and Video Calls**

The WebSocket infrastructure is already in place. Adding WebRTC signaling through the existing Socket.io gateway would enable peer-to-peer audio and video calls without routing media through the server.

**Message Search**

Full-text search across message history using MongoDB Atlas Search or Elasticsearch would allow users to find past messages quickly, which becomes important as conversation history grows.

**Horizontal Scaling**

The current deployment runs as a single instance. Scaling to multiple instances would require replacing the in-memory online user map in the WebSocket gateway with a Redis-backed adapter, so that socket events are broadcast correctly across all nodes.

**Admin Dashboard**

A management interface for monitoring active connections, system health, and user activity would be a practical addition for operating the service in production.
