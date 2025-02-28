# Mutual Link

<div align="center">
  <img src="https://via.placeholder.com/200x200.png?text=Mutual+Link" alt="Mutual Link Logo" width="200" height="200"/>
  <p><strong>A Decentralized Platform for Medical Data Sovereignty and Efficient Healthcare Services</strong></p>
</div>

## Project Overview

Mutual Link is transforming the medical referral system through a decentralized platform built on the Internet Computer Protocol (ICP). The system enables individuals to regain control over their medical data and experience improved healthcare services. Our vision is to create a data-driven referral system that fosters efficient and transparent communication between patients and healthcare providers.

### Technical Motivation

The implementation of ICP ensures our service meets strict availability and confidentiality requirements, which are critical for handling sensitive medical data while adhering to personal information protection laws. After evaluating various blockchain and distributed storage solutions, ICP was selected for its:

- **Chain Key Cryptography**: Enables secure and efficient access control
- **Subnet Architecture**: Provides high scalability and fault tolerance
- **On-chain Asset Delivery**: Eliminates reliance on traditional CDNs
- **Web Integration**: Seamless connectivity with existing web infrastructure

## Architecture

### Backend Canisters

The system is built using the following canister architecture:

1. **Authentication Canister**

   - Integrates with Web3Auth for decentralized identity management
   - Implements ECDSA signature verification
   - Manages user session states through orthogonal persistence

2. **Doctor Management Canister**

   - Handles doctor registration, verification, and credentials
   - Implements secure public key infrastructure for end-to-end encryption
   - Manages searchable doctor profiles with indexing capabilities

3. **Medical Record Management Canister**

   - Implements RBAC (Role-Based Access Control) for record access
   - Provides cryptographic verification of data integrity
   - Supports record transfer history with immutable audit trails

4. **Frontend Asset Canister**
   - Delivers web assets directly from the Internet Computer
   - Implements content security policies for XSS protection

### Data Encryption Flow

Medical records follow a secure encryption process:

1. Data is encrypted client-side using AES-256-GCM
2. The AES key is encrypted using the recipient's public RSA key
3. Encrypted data is stored on IPFS with CIDs recorded on-chain
4. Access control is managed through canister smart contracts
5. Data transfer occurs without exposing unencrypted content to intermediaries

## Technology Stack

- **Frontend**: Next.js, TypeScript, React Query for state management
- **Backend**: Internet Computer Protocol (ICP), Motoko
- **Smart Contracts**: Motoko with actor-based concurrency model
- **Security**: Web3Auth, RSA+AES hybrid encryption, threshold ECDSA
- **Storage**: Certified on-chain state with IPFS integration

## Project Structure

```
mutual-link/
├── src/
│   ├── mutual-link-backend/      # Motoko backend code
│   │   ├── main.mo               # Main entry point
│   │   ├── DoctorManagement.mo   # Doctor management module
│   │   └── MedicalRecordManagement.mo # Medical record management module
│   ├── mutual-link-frontend/     # Frontend assets
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Next.js page components
│   │   ├── services/             # API service integrations
│   │   ├── hooks/                # Custom React hooks
│   │   └── utils/                # Helper utilities
│   └── declarations/             # Auto-generated interfaces
├── dfx.json                      # DFX configuration file
└── package.json                  # Project dependencies
```

## Technical Implementation Roadmap

### Milestone 1: Web3Auth Integration and User Registration Canister

- Implement authentication canister with Web3Auth ECDSA integration
- Develop persistent user registration data structures with stable memory
- Initialize frontend asset canister with content security policies
- Implement cross-canister calls between auth and profile systems

### Milestone 2: Role-Based Access Control (RBAC) Canister

- Design permission hierarchy using principal-based access control
- Implement role management canister with upgrade mechanisms
- Develop administrator verification with threshold signatures
- Implement security guard patterns for method access control

### Milestone 3: Integration Testing and System Launch

- Develop integration test suite with Motoko test library
- Implement end-to-end testing with simulated user flows
- Performance optimization for canister cycles efficiency
- Final canister deployment with secure upgrade strategy

## Development Setup

### Prerequisites

- Node.js 16 or later
- DFX 0.13.1 or later
- Internet Computer SDK

### Local Development

```bash
# Install dependencies
npm install

# Start the replica in the background
dfx start --background

# Deploy canisters to the replica and generate candid interface
dfx deploy
```

Once deployed, your application will be available at `http://localhost:4943?canisterId={asset_canister_id}`.

### Generating Interface Definitions

After modifying backend canisters, generate updated type definitions:

```bash
npm run generate
```

### Frontend Development Server

```bash
npm start
```

This starts a server at `http://localhost:8080`, proxying API requests to the replica at port 4943.

## License

This project is licensed under the [MIT License](LICENSE).
