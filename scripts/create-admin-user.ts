import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'admin@test.com';
  const password = 'admin123';

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { admin: true }
  });

  if (existingUser) {
    console.log('User already exists:', existingUser.email);
    
    // Update password if needed
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });
    
    // Ensure admin record exists
    if (!existingUser.admin) {
      await prisma.admin.create({
        data: {
          userId: existingUser.id,
          role: 'admin'
        }
      });
      console.log('Admin role added to existing user');
    } else {
      // Update role to admin
      await prisma.admin.update({
        where: { userId: existingUser.id },
        data: { role: 'admin' }
      });
      console.log('Admin role updated');
    }
  } else {
    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Admin',
        password: hashedPassword,
        grade: 10
      }
    });

    // Create admin record
    await prisma.admin.create({
      data: {
        userId: user.id,
        role: 'admin'
      }
    });

    console.log('Admin user created:', email);
  }

  console.log('\nTest credentials:');
  console.log('Email:', email);
  console.log('Password:', password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
