import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

  // 1. Permissions
  const permissionsData = [
    {
      id: uuidv4(),
      status: "active",
      name: "view_dashboard",
      description: "Can view dashboard",
    },
    {
      id: uuidv4(),
      status: "active",
      name: "manage_clients",
      description: "Can manage clients",
    },
    {
      id: uuidv4(),
      status: "active",
      name: "manage_projects",
      description: "Can manage projects",
    },
    {
      id: uuidv4(),
      status: "active",
      name: "manage_invoices",
      description: "Can manage invoices",
    },
  ];

  await prisma.permission.createMany({ data: permissionsData });

  // 2. User
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      name: "Samir Khan",
      profession: "Full-Stack Developer",
      companyName: "PrimeWebDev",
      email: "samirkhan@gmail.com",
      googleId: null,
      mobileNumber: "99999999",
      passwordHash: "hashedpassword",
      role: "admin",
      adminAddress: "Jaipur, India",
      avatarUrl: "https://example.com/avatar.png",
      createdAt: now,
      updatedAt: now,
    },
  });

  // 3. UserPermissions
  const permissions = await prisma.permission.findMany();
  await prisma.userPermission.createMany({
    data: permissions.map((p) => ({
      userId: user.id,
      permissionId: p.id,
    })),
  });

  // 4. Client
  const client = await prisma.client.create({
    data: {
      id: uuidv4(),
      name: "Devendra Singh",
      email: "dev@example.com",
      phone: "8888888888",
      company: "DevSolutions",
      country: "India",
      status: "active",
      notes: "Long-term client",
      createdAt: now,
      updatedAt: now,
    },
  });

  // 5. Project
  const project = await prisma.project.create({
    data: {
      id: uuidv4(),
      clientId: client.id,
      title: "Ecommerce App",
      description: "Custom ecommerce platform for DevSolutions",
      startDate: now,
      endDate: later,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    },
  });

  // 6. Task
  await prisma.task.create({
    data: {
      id: uuidv4(),
      projectId: project.id,
      userId: user.id,
      title: "Design homepage",
      description: "Create wireframe and UI for homepage",
      status: "in_progress",
      priority: "low",
      dueDate: later,
      createdAt: now,
      updatedAt: now,
    },
  });

  // 7. Proposal
  await prisma.proposal.create({
    data: {
      id: uuidv4(),
      clientId: client.id,
      projectName: "New Web App Proposal",
      proposedServices: "Proposal for a SaaS app",
      date: now,
      amount: 50000,
      status: "sent",
      createdAt: now,
      updatedAt: now,
    },
  });

  // 8. Invoice
  const invoice = await prisma.invoice.create({
    data: {
      id: uuidv4(),
      usersId: user.id,
      clientId: client.id,
      projectId: project.id,
      amount: 25000,
      status: "pending",
      dueDate: later,
      issueDate: now,
      createdAt: now,
      updatedAt: now,
    },
  });

  // 9. Payment (as PaymentsWithdrawal)
  await prisma.paymentsWithdrawal.create({
    data: {
      id: uuidv4(),
      invoiceId: invoice.id,
      amount: 25000,
      transactionId: "txn123456",
      paymentMethod: "upi",
      paymentDate: now,
      createdAt: now,
    },
  });

  // 10. SocialMediaAccount (required for ScheduledPost)
  const socialAccount = await prisma.socialMediaAccount.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      platform: "twitter",
      username: "samir_dev",
      profileImageUrl: "https://example.com/image.png",
      authToken: "fake_token",
      createdAt: now,
    },
  });

  // 11. ScheduledPost
  await prisma.scheduledPost.create({
    data: {
      id: uuidv4(),
      socialMediaAccountId: socialAccount.id,
      contentText: "Check out our latest features!",
      mediaUrl: "https://example.com/image.png",
      scheduledAt: later,
      status: "scheduled",
      createdAt: now,
    },
  });

  // 12. Chat
  const chat = await prisma.chat.create({
    data: {
      id: uuidv4(),
      isGroup: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    },
  });

  // 13. Message
  await prisma.message.create({
    data: {
      id: uuidv4(),
      chatId: chat.id,
      senderId: user.id,
      content: "Hello! Let’s start working on the project.",
      messageType: "text",
      sentAt: now,
      updatedAt: now,
    },
  });

  console.log("🌱 Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
