import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const ReviewDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'modify']),
  notes: z.string().optional(),
  modifications: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = ReviewDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { decision, notes, modifications } = parsed.data;

    await prisma.template.update({
      where: { id: params.id },
      data: {
        reviewStatus: decision === 'approve' ? 'approved' : 'rejected',
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      },
    });

    await prisma.templateReview.create({
      data: {
        templateId: params.id,
        reviewerId: 'admin',
        decision,
        notes: notes || null,
        modifications: modifications || {},
        duration: 0,
      },
    });

    return NextResponse.json({
      success: true,
      templateId: params.id,
      decision,
    });
  } catch (error) {
    console.error('Review decision error:', error);
    return NextResponse.json(
      { error: 'Failed to process review decision' },
      { status: 500 }
    );
  }
}
