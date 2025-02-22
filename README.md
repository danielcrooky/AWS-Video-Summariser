AWS Video Summariser

Overview

This application allows users to upload, view, and summarise videos. Once a user signs up or logs in, they are greeted with a dashboard showing all their uploaded videos. Users can upload new videos from their local machine, stream them directly from the dashboard, and generate summaries. The summarisation process involves transcribing the video and then using an AI API to produce a concise summary. Once processed, the summary is saved with the video so that it can be accessed later—even after logging out.


Application Architecture

The application is designed as a set of microservices that separate the user interface from the CPU-intensive video processing tasks. Key AWS services include:

Route 53: Manages DNS routing for the registered domains.
Certificate Manager: Provides SSL/TLS certificates for secure HTTPS communications.
Application Load Balancer: Forwards user requests to backend EC2 instances.
EC2: Hosts the Node.js backend responsible for serving the website and handling video uploads.
Elastic Container Registry (ECR): Stores Docker images for both the backend and the video processing worker.
Secrets Manager & Parameter Store: Securely manages environment variables and secrets.
S3: Stores uploaded video files along with their transcripts and summaries.
RDS (MySQL): Hosts the database for video metadata such as file names and uploader details.
Cognito: Manages user authentication and account management.
SQS: Acts as a job queue for videos waiting to be processed.
ECS (Fargate): Runs the worker service that transcribes videos and generates summaries, with autoscaling based on CPU usage.

Project Components

Web Backend
Functionality:
Handles user authentication, video upload, video streaming, and summary retrieval.
Compute:
Runs on EC2 instances.
Source Files:
Located in the web-backend directory.
Video Processing Service
Functionality:
Transcribes videos and generates summaries using an AI API.
Compute:
Runs as a containerized service on ECS (Fargate).
Source Files:
Worker code found in Worker/worker.js.


Justification & Scalability

The system is split into two microservices to ensure that the user interface remains responsive while the CPU-intensive video processing tasks are handled separately. This design not only allows each component to scale independently but also ensures that resource-heavy processes do not impede user interactions. The use of SQS for job queuing further decouples these services, providing better load distribution and fault tolerance.



Additional Considerations

Security
Data in Transit:
All communications are secured over HTTPS using SSL/TLS certificates.
Data at Rest:
Sensitive data is encrypted in both S3 and RDS, with credentials managed through Secrets Manager.
Authentication:
User authentication and account management are handled by AWS Cognito.
Network Security:
Security groups are configured to restrict access between services, with potential enhancements using AWS Web Application Firewall (WAF).
Sustainability
Efficiency:
Optimised processing algorithms and reduced data transfers (e.g., through caching and data compression) lower CPU and network usage.
Resource Management:
Auto-scaling and the use of energy-efficient instance types (like Graviton-based instances) help minimize energy consumption.
Data Management:
Implementing policies to remove unused resources and data further enhances sustainability.



Scaling Up

To support up to 10,000 concurrent users, the application would be further decomposed into additional microservices. Enhancements might include:

Dedicated User Management Service: To better handle authentication and account management during peak times.
Dedicated Upload Service: To manage high data throughput for video uploads.
API Gateway: To route API requests to the appropriate microservices, implement caching, and improve monitoring.
Infrastructure Upgrades: Upgrading instance types (e.g., to m5.large for EC2 and RDS) and increasing ECS task limits for more robust processing.
