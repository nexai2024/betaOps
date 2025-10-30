// Prisma Seed Script for BetaOps

import { PrismaClient, RegulatoryRegime, RiskLevel, MemberRole, TestArtifactType, ArtifactSource, ArtifactStatus, TestCycleStatus, TestCaseStatus } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");
  
  // Clear existing data (be careful in production!)
  await prisma.auditEvent.deleteMany();
  await prisma.signOff.deleteMany();
  await prisma.issueSyncEvent.deleteMany();
  await prisma.issueLink.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.testCaseInstance.deleteMany();
  await prisma.testCycle.deleteMany();
  await prisma.testPlan.deleteMany();
  await prisma.testArtifact.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  
  console.log("✅ Cleared existing data");
  
  // Create users
  const passwordHash = await hash("password123", 10);
  
  const owner = await prisma.user.create({
    data: {
      name: "Alice Johnson",
      email: "alice@betaops.dev",
      password: passwordHash,
      emailVerified: new Date(),
      role: "OWNER",
    },
  });
  
  const maintainer = await prisma.user.create({
    data: {
      name: "Bob Smith",
      email: "bob@betaops.dev",
      password: passwordHash,
      emailVerified: new Date(),
      role: "MAINTAINER",
    },
  });
  
  const tester1 = await prisma.user.create({
    data: {
      name: "Carol Williams",
      email: "carol@betaops.dev",
      password: passwordHash,
      emailVerified: new Date(),
      role: "TESTER",
    },
  });
  
  const tester2 = await prisma.user.create({
    data: {
      name: "David Brown",
      email: "david@betaops.dev",
      password: passwordHash,
      emailVerified: new Date(),
      role: "TESTER",
    },
  });
  
  console.log("✅ Created users");
  
  // ============================================================================
  // PROJECT 1: Simple E-commerce SPA
  // ============================================================================
  
  const ecommerceProject = await prisma.project.create({
    data: {
      name: "ShopFast - E-commerce Platform",
      slug: "shopfast-ecommerce",
      description: "A modern e-commerce single-page application built with React and Next.js. Features include product browsing, shopping cart, checkout, and user accounts.",
      riskLevel: RiskLevel.MEDIUM,
      repositories: [
        {
          url: "https://github.com/betaops-demo/shopfast-spa",
          branch: "main",
          primary: true,
        },
      ],
      members: {
        create: [
          {
            userId: owner.id,
            role: MemberRole.OWNER,
            joinedAt: new Date(),
          },
          {
            userId: maintainer.id,
            role: MemberRole.MAINTAINER,
            joinedAt: new Date(),
          },
          {
            userId: tester1.id,
            role: MemberRole.TESTER,
            joinedAt: new Date(),
          },
        ],
      },
      environments: {
        create: [
          { name: "development", url: "http://localhost:3000", order: 0 },
          { name: "staging", url: "https://staging.shopfast.dev", order: 1 },
          { name: "production", url: "https://shopfast.com", order: 2 },
        ],
      },
    },
  });
  
  // E-commerce features
  const ecomFeatures = await Promise.all([
    prisma.feature.create({
      data: {
        projectId: ecommerceProject.id,
        name: "Product Catalog",
        description: "Browse and search products with filtering and sorting",
        tags: ["products", "search", "filtering"],
        riskLevel: RiskLevel.MEDIUM,
        order: 0,
      },
    }),
    prisma.feature.create({
      data: {
        projectId: ecommerceProject.id,
        name: "Shopping Cart",
        description: "Add, remove, and update items in cart",
        tags: ["cart", "checkout"],
        riskLevel: RiskLevel.HIGH,
        order: 1,
      },
    }),
    prisma.feature.create({
      data: {
        projectId: ecommerceProject.id,
        name: "User Authentication",
        description: "Sign up, sign in, password reset",
        tags: ["auth", "security"],
        riskLevel: RiskLevel.HIGH,
        order: 2,
      },
    }),
    prisma.feature.create({
      data: {
        projectId: ecommerceProject.id,
        name: "Checkout Process",
        description: "Multi-step checkout with payment integration",
        tags: ["checkout", "payment", "stripe"],
        riskLevel: RiskLevel.CRITICAL,
        order: 3,
      },
    }),
  ]);
  
  // Add sub-features for Shopping Cart
  await prisma.feature.create({
    data: {
      projectId: ecommerceProject.id,
      parentId: ecomFeatures[1].id,
      name: "Add to Cart",
      description: "Add products to shopping cart",
      tags: ["cart"],
      riskLevel: RiskLevel.HIGH,
      order: 0,
    },
  });
  
  await prisma.feature.create({
    data: {
      projectId: ecommerceProject.id,
      parentId: ecomFeatures[1].id,
      name: "Update Quantity",
      description: "Change product quantities in cart",
      tags: ["cart"],
      riskLevel: RiskLevel.MEDIUM,
      order: 1,
    },
  });
  
  // Test artifacts for e-commerce
  const ecomArtifacts = await Promise.all([
    prisma.testArtifact.create({
      data: {
        projectId: ecommerceProject.id,
        type: TestArtifactType.USER_STORY,
        title: "As a shopper, I want to browse products by category",
        content: JSON.stringify({
          description: "As a shopper, I want to browse products by category so that I can easily find what I'm looking for.",
          acceptanceCriteria: [
            "Categories are displayed in navigation",
            "Clicking a category shows relevant products",
            "Product count is shown for each category",
            "Empty categories show appropriate message",
          ],
        }),
        featureIds: [ecomFeatures[0].id],
        tags: ["products", "browsing"],
        source: ArtifactSource.AI,
        aiModel: "gpt-4",
        status: ArtifactStatus.APPROVED,
        createdById: maintainer.id,
        publishedAt: new Date(),
      },
    }),
    prisma.testArtifact.create({
      data: {
        projectId: ecommerceProject.id,
        type: TestArtifactType.TEST_CASE,
        title: "Verify adding product to cart",
        content: JSON.stringify({
          description: "Test that products can be successfully added to the shopping cart",
          preconditions: ["User is on product detail page", "Product is in stock"],
          steps: [
            { order: 1, action: "Click 'Add to Cart' button", expectedBehavior: "Button shows loading state" },
            { order: 2, action: "Wait for confirmation", expectedBehavior: "Success message appears" },
            { order: 3, action: "Check cart icon", expectedBehavior: "Cart count increments by 1" },
            { order: 4, action: "Navigate to cart page", expectedBehavior: "Product is visible in cart" },
          ],
          expectedResult: "Product is added to cart and visible in cart page with correct quantity and price",
        }),
        featureIds: [ecomFeatures[1].id],
        tags: ["cart", "smoke"],
        source: ArtifactSource.AI,
        aiModel: "gpt-4",
        status: ArtifactStatus.APPROVED,
        createdById: maintainer.id,
        publishedAt: new Date(),
        metadata: {
          priority: "HIGH",
          type: "functional",
        },
      },
    }),
    prisma.testArtifact.create({
      data: {
        projectId: ecommerceProject.id,
        type: TestArtifactType.TEST_CASE,
        title: "Verify checkout with valid payment",
        content: JSON.stringify({
          description: "Test complete checkout flow with successful payment",
          preconditions: ["User is logged in", "Cart has at least one item", "Test card details available"],
          steps: [
            { order: 1, action: "Navigate to cart and click 'Checkout'", expectedBehavior: "Checkout page loads" },
            { order: 2, action: "Fill in shipping address", expectedBehavior: "Form validation passes" },
            { order: 3, action: "Select shipping method", expectedBehavior: "Price updates" },
            { order: 4, action: "Enter test card details", expectedBehavior: "Card validation passes" },
            { order: 5, action: "Click 'Place Order'", expectedBehavior: "Processing indicator shows" },
            { order: 6, action: "Wait for confirmation", expectedBehavior: "Order confirmation page loads" },
          ],
          expectedResult: "Order is placed successfully, confirmation email sent, order appears in user's order history",
        }),
        featureIds: [ecomFeatures[3].id],
        tags: ["checkout", "payment", "critical"],
        source: ArtifactSource.MANUAL,
        status: ArtifactStatus.APPROVED,
        createdById: maintainer.id,
        publishedAt: new Date(),
        metadata: {
          priority: "CRITICAL",
          type: "functional",
        },
      },
    }),
  ]);
  
  // Test cycle for e-commerce
  const ecomCycle = await prisma.testCycle.create({
    data: {
      projectId: ecommerceProject.id,
      name: "Sprint 12 - Cart & Checkout",
      description: "Testing shopping cart and checkout functionality for Sprint 12",
      version: "v1.12.0",
      branch: "main",
      commitSha: "a1b2c3d4e5f6",
      commitMessage: "feat: improved cart performance and checkout UI",
      status: TestCycleStatus.IN_PROGRESS,
      startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
  });
  
  // Test case instances
  await Promise.all([
    prisma.testCaseInstance.create({
      data: {
        cycleId: ecomCycle.id,
        artifactId: ecomArtifacts[1].id,
        assigneeId: tester1.id,
        status: TestCaseStatus.PASSED,
        environmentId: (await prisma.environment.findFirst({
          where: { projectId: ecommerceProject.id, name: "staging" },
        }))!.id,
        executionNotes: "All steps executed successfully. Cart updates correctly.",
        startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        duration: 300,
        browserInfo: "Chrome 120.0",
        deviceInfo: "Desktop - Windows 11",
      },
    }),
    prisma.testCaseInstance.create({
      data: {
        cycleId: ecomCycle.id,
        artifactId: ecomArtifacts[2].id,
        assigneeId: tester1.id,
        status: TestCaseStatus.IN_PROGRESS,
        environmentId: (await prisma.environment.findFirst({
          where: { projectId: ecommerceProject.id, name: "staging" },
        }))!.id,
        startedAt: new Date(),
        browserInfo: "Chrome 120.0",
        deviceInfo: "Desktop - Windows 11",
      },
    }),
  ]);
  
  console.log("✅ Created ShopFast e-commerce project");
  
  // ============================================================================
  // PROJECT 2: MedConnect - HIPAA-Compliant Medical Platform
  // ============================================================================
  
  const medicalProject = await prisma.project.create({
    data: {
      name: "MedConnect - Patient Portal",
      slug: "medconnect-portal",
      description: "HIPAA-compliant patient portal for healthcare providers. Enables secure messaging, appointment scheduling, and medical record access.",
      regulatoryRegime: RegulatoryRegime.HIPAA,
      riskLevel: RiskLevel.CRITICAL,
      complianceMode: true,
      complianceConfig: {
        dualSignOff: true,
        segregationOfDuties: true,
        evidenceRetention: 2555, // 7 years
        piiRedaction: "required",
        auditTrail: "full",
        requiredReviewers: ["qa-lead", "security-officer"],
      },
      repositories: [
        {
          url: "https://github.com/medconnect/patient-portal",
          branch: "main",
          primary: true,
        },
      ],
      members: {
        create: [
          {
            userId: owner.id,
            role: MemberRole.OWNER,
            joinedAt: new Date(),
          },
          {
            userId: maintainer.id,
            role: MemberRole.MAINTAINER,
            joinedAt: new Date(),
          },
          {
            userId: tester2.id,
            role: MemberRole.TESTER,
            joinedAt: new Date(),
          },
        ],
      },
      environments: {
        create: [
          { name: "development", url: "https://dev.medconnect.health", order: 0 },
          { name: "staging", url: "https://staging.medconnect.health", order: 1 },
          { name: "production", url: "https://portal.medconnect.health", order: 2 },
        ],
      },
    },
  });
  
  // Medical app features
  const medFeatures = await Promise.all([
    prisma.feature.create({
      data: {
        projectId: medicalProject.id,
        name: "Patient Authentication",
        description: "Multi-factor authentication with biometric support",
        tags: ["auth", "security", "mfa"],
        riskLevel: RiskLevel.CRITICAL,
        order: 0,
      },
    }),
    prisma.feature.create({
      data: {
        projectId: medicalProject.id,
        name: "Medical Records Access",
        description: "View and download medical records and test results",
        tags: ["records", "phi", "hipaa"],
        riskLevel: RiskLevel.CRITICAL,
        order: 1,
      },
    }),
    prisma.feature.create({
      data: {
        projectId: medicalProject.id,
        name: "Secure Messaging",
        description: "HIPAA-compliant messaging with healthcare providers",
        tags: ["messaging", "phi", "encrypted"],
        riskLevel: RiskLevel.HIGH,
        order: 2,
      },
    }),
    prisma.feature.create({
      data: {
        projectId: medicalProject.id,
        name: "Appointment Scheduling",
        description: "Schedule, reschedule, and cancel appointments",
        tags: ["appointments", "scheduling"],
        riskLevel: RiskLevel.MEDIUM,
        order: 3,
      },
    }),
  ]);
  
  // Test artifacts for medical app
  const medArtifacts = await Promise.all([
    prisma.testArtifact.create({
      data: {
        projectId: medicalProject.id,
        type: TestArtifactType.TEST_CASE,
        title: "Verify PHI data is encrypted at rest",
        content: JSON.stringify({
          description: "Verify that Protected Health Information is properly encrypted in the database",
          preconditions: ["Database access available", "Test patient data exists"],
          steps: [
            { order: 1, action: "Query patient table directly", expectedBehavior: "PHI fields are encrypted" },
            { order: 2, action: "Check encryption algorithm", expectedBehavior: "AES-256 or stronger" },
            { order: 3, action: "Verify key management", expectedBehavior: "Keys stored in secure vault" },
            { order: 4, action: "Test decryption through API", expectedBehavior: "Data decrypts correctly for authorized users" },
          ],
          expectedResult: "All PHI data is encrypted at rest using approved encryption standards",
        }),
        featureIds: [medFeatures[1].id],
        tags: ["security", "hipaa", "encryption", "critical"],
        source: ArtifactSource.MANUAL,
        status: ArtifactStatus.APPROVED,
        createdById: maintainer.id,
        publishedAt: new Date(),
        metadata: {
          priority: "CRITICAL",
          type: "security",
        },
      },
    }),
    prisma.testArtifact.create({
      data: {
        projectId: medicalProject.id,
        type: TestArtifactType.TEST_CASE,
        title: "Verify audit log for medical record access",
        content: JSON.stringify({
          description: "Ensure all access to medical records is logged with required HIPAA audit information",
          preconditions: ["User with valid credentials", "Test patient records available"],
          steps: [
            { order: 1, action: "Log in as patient", expectedBehavior: "Login successful" },
            { order: 2, action: "Access medical record", expectedBehavior: "Record loads correctly" },
            { order: 3, action: "Check audit log", expectedBehavior: "Access event logged with timestamp, user ID, IP, action" },
            { order: 4, action: "Verify log immutability", expectedBehavior: "Log cannot be modified or deleted" },
            { order: 5, action: "Test unauthorized access attempt", expectedBehavior: "Access denied and logged" },
          ],
          expectedResult: "All access attempts are logged with complete audit trail meeting HIPAA requirements",
        }),
        featureIds: [medFeatures[1].id],
        tags: ["audit", "hipaa", "compliance", "critical"],
        source: ArtifactSource.MANUAL,
        status: ArtifactStatus.APPROVED,
        createdById: maintainer.id,
        publishedAt: new Date(),
        metadata: {
          priority: "CRITICAL",
          type: "security",
        },
      },
    }),
    prisma.testArtifact.create({
      data: {
        projectId: medicalProject.id,
        type: TestArtifactType.TEST_CASE,
        title: "Verify MFA authentication flow",
        content: JSON.stringify({
          description: "Test multi-factor authentication for patient login",
          preconditions: ["Test patient account with MFA enabled"],
          steps: [
            { order: 1, action: "Enter username and password", expectedBehavior: "Proceeds to MFA prompt" },
            { order: 2, action: "Request MFA code", expectedBehavior: "Code sent to registered device" },
            { order: 3, action: "Enter valid MFA code", expectedBehavior: "Login successful" },
            { order: 4, action: "Test invalid MFA code", expectedBehavior: "Access denied with error message" },
            { order: 5, action: "Test expired MFA code", expectedBehavior: "Prompt to request new code" },
          ],
          expectedResult: "MFA flow works correctly for all scenarios, properly securing access",
        }),
        featureIds: [medFeatures[0].id],
        tags: ["auth", "mfa", "security", "critical"],
        source: ArtifactSource.AI,
        aiModel: "gpt-4",
        status: ArtifactStatus.APPROVED,
        createdById: maintainer.id,
        publishedAt: new Date(),
        metadata: {
          priority: "CRITICAL",
          type: "security",
        },
      },
    }),
  ]);
  
  // Test cycle for medical app
  const medCycle = await prisma.testCycle.create({
    data: {
      projectId: medicalProject.id,
      name: "Q1 2024 Security Audit",
      description: "Quarterly security and compliance testing for HIPAA certification",
      version: "v2.5.0",
      branch: "release/2.5",
      commitSha: "f1e2d3c4b5a6",
      commitMessage: "security: enhanced encryption and audit logging",
      status: TestCycleStatus.COMPLETED,
      startAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      qualityGatesPassed: true,
    },
  });
  
  // Test case instances with sign-offs
  const medTestInstance = await prisma.testCaseInstance.create({
    data: {
      cycleId: medCycle.id,
      artifactId: medArtifacts[0].id,
      assigneeId: tester2.id,
      status: TestCaseStatus.PASSED,
      environmentId: (await prisma.environment.findFirst({
        where: { projectId: medicalProject.id, name: "production" },
      }))!.id,
      environmentSnapshot: {
        name: "production",
        encryptionEnabled: true,
        hipaaCompliant: true,
      },
      executionNotes: "All encryption tests passed. AES-256 confirmed. Key rotation verified.",
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
      duration: 2700,
      browserInfo: "Chrome 120.0",
      deviceInfo: "Secure Testing Environment",
    },
  });
  
  // Add sign-off
  await prisma.signOff.create({
    data: {
      testCaseInstanceId: medTestInstance.id,
      signedById: tester2.id,
      attestation: "I attest that this test was executed according to the test plan and all results are accurate. PHI data encryption verified.",
      signature: "sha256:abc123def456...",
      version: "v2.5.0",
      environment: "production",
      commitSha: "f1e2d3c4b5a6",
      ipAddress: "10.0.1.50",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
    },
  });
  
  // Quality gate
  await prisma.qualityGate.create({
    data: {
      projectId: medicalProject.id,
      name: "HIPAA Compliance Gate",
      description: "All critical security and compliance tests must pass before production release",
      environment: "production",
      conditions: [
        { type: "criticalTestsPassing", threshold: 100 },
        { type: "mandatorySignOffs", required: ["tester", "qa-lead", "security-officer"] },
        { type: "noBlockingIssues", severity: "critical" },
      ],
      onFail: "block",
      isActive: true,
      order: 0,
    },
  });
  
  console.log("✅ Created MedConnect medical project");
  
  // ============================================================================
  // Audit Events
  // ============================================================================
  
  await prisma.auditEvent.create({
    data: {
      projectId: medicalProject.id,
      actorId: tester2.id,
      action: "test.executed",
      resource: "test_case_instance",
      resourceId: medTestInstance.id,
      payload: {
        testCaseId: medArtifacts[0].id,
        status: "PASSED",
        environment: "production",
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
  
  await prisma.auditEvent.create({
    data: {
      projectId: medicalProject.id,
      actorId: tester2.id,
      action: "test.signed_off",
      resource: "test_case_instance",
      resourceId: medTestInstance.id,
      payload: {
        testCaseId: medArtifacts[0].id,
        version: "v2.5.0",
        environment: "production",
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
    },
  });
  
  console.log("✅ Created audit events");
  
  console.log(`
  
🎉 Seed completed successfully!

📊 Summary:
  - Users: 4 (1 owner, 1 maintainer, 2 testers)
  - Projects: 2
    • ShopFast E-commerce (Simple SPA)
    • MedConnect Patient Portal (HIPAA-compliant)
  - Features: 10 total
  - Test Artifacts: 6 total
  - Test Cycles: 2 (1 in-progress, 1 completed)
  - Test Case Instances: 3
  - Sign-offs: 1 (with compliance attestation)

🔐 Login Credentials:
  All users: password123
  
  - Owner: alice@betaops.dev
  - Maintainer: bob@betaops.dev
  - Tester: carol@betaops.dev
  - Tester: david@betaops.dev

🚀 Next Steps:
  1. Run: npm run dev
  2. Visit: http://localhost:3000
  3. Sign in with any of the above credentials
  4. Explore the projects, features, and test cycles!
  `);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
