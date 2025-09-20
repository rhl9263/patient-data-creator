# Deployment Architecture: AWS Amplify + Lambda + API Gateway (Private Backend)

This document explains how the HDH Patient Data Creator app is deployed to AWS Amplify and securely accesses a private Health Data Hub (HDH) API using AWS Lambda and API Gateway.

---

## Architecture Overview

```
User Browser
    |
    v
[Amplify Hosting (Next.js App)]
    |
    |  (POST /api/proxy)
    v
[Next.js API Route (Amplify SSR/Server Function)]
    |
    |  (POST to Lambda Proxy URL)
    v
[API Gateway (Public Endpoint)]
    |
    |  (Triggers Lambda in VPC)
    v
[AWS Lambda (in VPC)]
    |
    |  (POST to HDH API)
    v
[HDH API (Private Network)]
```

---

## Step-by-Step Deployment

### 1. **Deploy the Next.js App to AWS Amplify**
- Push your code to GitHub/Bitbucket.
- Connect the repo to AWS Amplify.
- Set environment variable `LAMBDA_PROXY_URL` in Amplify Console to your API Gateway endpoint.
- Amplify builds and hosts the app, including API routes.

### 2. **Create a Lambda Function in Your VPC**
- Go to AWS Lambda Console.
- Create a new function (Node.js runtime).
- Attach it to your VPC/subnets/security group with access to the HDH API.
- Lambda code proxies requests to the private HDH API.

### 3. **Expose Lambda via API Gateway**
- Add an API Gateway trigger to your Lambda.
- Deploy the API Gateway endpoint (public, but only triggers your Lambda).

### 4. **Configure the Next.js API Route**
- The `/api/proxy` route in your app reads `LAMBDA_PROXY_URL` from the environment.
- It POSTs all requests to the API Gateway endpoint, which triggers Lambda.
- Lambda, running in your VPC, can access the private HDH API.

---

## Diagram

Below is a diagram of the deployment flow:

![alt text](<Load Patient Data.png>)
---

## Notes
- The HDH API is not accessible from the public internet; only Lambda in the VPC can reach it.
- All credentials and endpoints are managed via Amplify environment variables for security.
- This pattern allows you to use Amplify’s managed hosting while securely accessing private backend resources.

---

For more details, see the main `README.md`.
