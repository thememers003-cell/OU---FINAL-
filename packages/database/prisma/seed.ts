import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding XPOS database...');

  // ── Create Pricing Rules ──
  await prisma.pricingRule.upsert({
    where: { paperSize_colorMode: { paperSize: 'A4', colorMode: 'BW' } },
    update: {},
    create: {
      paperSize: 'A4',
      colorMode: 'BW',
      pricePerPage: 2,
      isActive: true,
    },
  });

  await prisma.pricingRule.upsert({
    where: { paperSize_colorMode: { paperSize: 'A4', colorMode: 'COLOR' } },
    update: {},
    create: {
      paperSize: 'A4',
      colorMode: 'COLOR',
      pricePerPage: 10,
      isActive: true,
    },
  });

  console.log('✅ Pricing rules created');

  // ── Create Demo Kiosks ──
  const kiosk1 = await prisma.kiosk.upsert({
    where: { displayId: 'XPOS-001' },
    update: {},
    create: {
      displayId: 'XPOS-001',
      name: 'College Library Kiosk',
      location: 'College Library, Ground Floor',
      status: 'ACTIVE',
      qrUrl: 'http://localhost:3000/print?kiosk=XPOS-001',
    },
  });

  const kiosk2 = await prisma.kiosk.upsert({
    where: { displayId: 'XPOS-002' },
    update: {},
    create: {
      displayId: 'XPOS-002',
      name: 'Hostel Block A Kiosk',
      location: 'Hostel Block A, Reception',
      status: 'ACTIVE',
      qrUrl: 'http://localhost:3000/print?kiosk=XPOS-002',
    },
  });

  const kiosk3 = await prisma.kiosk.upsert({
    where: { displayId: 'XPOS-003' },
    update: {},
    create: {
      displayId: 'XPOS-003',
      name: 'Main Gate Kiosk',
      location: 'Main Gate, Security Office',
      status: 'MAINTENANCE',
      qrUrl: 'http://localhost:3000/print?kiosk=XPOS-003',
    },
  });

  console.log('✅ Demo kiosks created');

  // ── Create Printers for Kiosks ──
  await prisma.printer.upsert({
    where: { kioskId: kiosk1.id },
    update: {},
    create: {
      name: 'HP LaserJet Pro M404',
      model: 'HP LaserJet Pro M404',
      status: 'READY',
      kioskId: kiosk1.id,
    },
  });

  await prisma.printer.upsert({
    where: { kioskId: kiosk2.id },
    update: {},
    create: {
      name: 'Canon imageCLASS LBP226',
      model: 'Canon imageCLASS LBP226',
      status: 'READY',
      kioskId: kiosk2.id,
    },
  });

  await prisma.printer.upsert({
    where: { kioskId: kiosk3.id },
    update: {},
    create: {
      name: 'Brother HL-L2350DW',
      model: 'Brother HL-L2350DW',
      status: 'OFFLINE',
      kioskId: kiosk3.id,
    },
  });

  console.log('✅ Printers created');

  // ── Create Admin User ──
  const passwordHash = crypto
    .createHash('sha256')
    .update('admin123')
    .digest('hex');

  await prisma.adminUser.upsert({
    where: { email: 'admin@xpos.app' },
    update: {},
    create: {
      email: 'admin@xpos.app',
      passwordHash,
      name: 'XPOS Admin',
      role: 'admin',
    },
  });

  console.log('✅ Admin user created (admin@xpos.app / admin123)');

  // ── Create Default Settings ──
  const settings = [
    { key: 'print_code_expiry_minutes', value: '30', description: 'Print code expiry time in minutes' },
    { key: 'max_file_size_mb', value: '50', description: 'Maximum file upload size in MB' },
    { key: 'file_retention_minutes', value: '30', description: 'Time to keep files after printing' },
    { key: 'max_copies', value: '20', description: 'Maximum number of copies per job' },
    { key: 'kiosk_idle_timeout_ms', value: '60000', description: 'Kiosk idle timeout in milliseconds' },
    { key: 'kiosk_heartbeat_interval_ms', value: '30000', description: 'Kiosk heartbeat interval in milliseconds' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Default settings created');

  console.log('\n🎉 XPOS database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
