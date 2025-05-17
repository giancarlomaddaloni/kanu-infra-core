# 🚀 Kanu Infra Launcher

A robust AWS CDK TypeScript framework to launch Lambda-based APIs, ECS services, and API Gateway endpoints — ideal for internal tools, microservices, or event-driven systems.

---

## 🧩 Features

- ⚙️ Full TypeScript CDK deployment
- 🖥 Deploy APIs via API Gateway v2 (HTTP/Lambda)
- 📦 Container-based services via ECS + ECR
- 🔐 Parameter storage & secrets via SSM
- 🌐 DNS routing via Route53 + Load Balancing
- 🛡️ IAM role scaffolding

---

## 🧬 Project Structure

```
kanu-infra-launcher/
├── bin/
│   └── kanu.ts           # CDK app entrypoint (you must add this)
├── iam/
│   └── userPolicy.json       # IAM access templates
├── test/                     # (Optional) Jest test directory
├── package.json
├── tsconfig.json
├── cdk.json
├── jest.config.js
└── LICENSE
```

---

## 🚀 Deployment

```bash
npm install       # install dependencies
npm run build     # compile TypeScript
npx cdk synth     # synth CloudFormation template
npx cdk deploy    # deploy to AWS
```

---

## 🧪 Testing

```bash
npm run test      # Jest tests (add your tests in `test/`)
```

---

## ⚠️ IAM Permissions Note

The provided `iam/userPolicy.json` is **very permissive** (`"Resource": "*"`) and grants full access to:
- Lambda, ECS, SSM, API Gateway, Route53, etc.

🔐 **Recommendation**: Refactor to use ARNs and scoped policies per construct/environment.

---

## 🧾 License

MIT — Use freely with attribution.

---

## 👤 Author

**Giancarlo Maddaloni**  
DevOps Architect — Kanu Technologies
