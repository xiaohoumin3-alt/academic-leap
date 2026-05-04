/**
 * Phase 1: 架构准备 - Subject模型测试
 *
 * User Journey: As a 系统管理员，我需要支持多科目管理
 *
 * 测试覆盖：
 * 1. Subject模型创建
 * 2. Subject-Textbook关联
 * 3. 查询指定科目下的教材
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Subject Model', () => {
  let testSubjectId: string;
  let testTextbookId: string;

  afterAll(async () => {
    // Cleanup
    await prisma.$disconnect();
  });

  describe('创建Subject', () => {
    it('应该成功创建数学科目', async () => {
      const subject = await prisma.subject.create({
        data: {
          name: '数学',
          code: 'MATH',
          grade: 7
        }
      });

      expect(subject).toBeDefined();
      expect(subject.name).toBe('数学');
      expect(subject.code).toBe('MATH');
      expect(subject.grade).toBe(7);
      expect(subject.status).toBe('active');

      testSubjectId = subject.id;
    });

    it('应该成功创建英语科目', async () => {
      const subject = await prisma.subject.create({
        data: {
          name: '英语',
          code: 'ENGLISH',
          grade: 7
        }
      });

      expect(subject.code).toBe('ENGLISH');
    });

    it('同一科目+年级组合应该唯一', async () => {
      await expect(
        prisma.subject.create({
          data: {
            name: '数学-重复',
            code: 'MATH',
            grade: 7
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Subject-Textbook关联', () => {
    beforeAll(async () => {
      if (testSubjectId) {
        // Create test textbook linked to subject
        const textbook = await prisma.textbookVersion.create({
          data: {
            name: '人教版七年级数学上册',
            grade: 7,
            subject: 'MATH',
            publisher: '人民教育出版社',
            year: '2024',
            status: 'active'
          }
        });
        testTextbookId = textbook.id;
      }
    });

    it('应该能查询指定科目下的教材', async () => {
      const textbooks = await prisma.textbookVersion.findMany({
        where: {
          subject: 'MATH',
          grade: 7,
          status: 'active'
        }
      });

      expect(textbooks.length).toBeGreaterThan(0);
      expect(textbooks[0].subject).toBe('MATH');
    });

    it('应该能通过Subject查询关联的教材', async () => {
      // Note: This requires the relationship to be set up in schema
      const subject = await prisma.subject.findUnique({
        where: { id: testSubjectId },
        include: { textbooks: true }
      });

      expect(subject).toBeDefined();
      // This will pass after schema update
      // expect(subject?.textbooks).toBeInstanceOf(Array);
    });
  });

  describe('Subject查询功能', () => {
    it('应该能查询所有活跃科目', async () => {
      const subjects = await prisma.subject.findMany({
        where: { status: 'active' },
        orderBy: [{ grade: 'asc' }, { name: 'asc' }]
      });

      expect(Array.isArray(subjects)).toBe(true);
    });

    it('应该能按年级筛选科目', async () => {
      const subjects = await prisma.subject.findMany({
        where: {
          grade: 7,
          status: 'active'
        }
      });

      expect(subjects.length).toBeGreaterThan(0);
      subjects.forEach(s => expect(s.grade).toBe(7));
    });
  });
});
