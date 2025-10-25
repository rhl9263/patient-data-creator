
# HDH Patient Data Creator

HDH Patient Data Creator is a web application for generating and submitting synthetic patient data records to a Health Data Hub API. It is designed for healthcare developers, testers, and data engineers who need to create, customize, and send test patient data for integration, QA, or demonstration purposes.

## Features

- User-friendly registration and login for API credentials and domain.
- Select clinical data categories (allergies, medications, conditions, etc.) to include in each patient record.
- Specify the number of patient records to generate in a batch.
- Generates realistic, randomized patient data for each record.
- Submits all records to a configurable Health Data Hub API endpoint using secure Basic Auth.
- Displays API responses for each record, including error details if any.
- Modern, responsive UI built with React and Tailwind CSS.

## How to Run Locally

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `src/app/register` — Registration page for API credentials and domain.
- `src/app/create-patients` — Main interface for generating and submitting patient data.
- `src/app/api/proxy/route.js` — API route that securely proxies data to the Health Data Hub backend.
- `src/components/data.json` — Template data for generating patient records.


## Deployment: AWS Amplify + Lambda + API Gateway (Private Backend)

This app is designed to be deployed on AWS Amplify with secure access to a private Health Data Hub (HDH) API using AWS Lambda and API Gateway.

**Key Points:**
- The app is hosted on AWS Amplify (static + server functions).
- All API requests from the app go to a Next.js API route (`/api/proxy`).
- The API route forwards requests to a Lambda function (via API Gateway) using the `LAMBDA_PROXY_URL` environment variable.
- The Lambda function runs inside your VPC and can access the private HDH API.
- This allows secure, managed hosting with private backend access.


**Production Domain:**

- https://patient-data-creator.rnd.hdh.nextgenaws.net/register

See [DEPLOYMENT.md](./DEPLOYMENT.md) for a full architecture diagram and step-by-step deployment instructions.

## License

MIT License. See [LICENSE](LICENSE) for details.
