import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { LLMClient } from '@/lib/template-factory/utils/llm-client';
import { TemplateGenerator } from '@/lib/template-factory/generator';
import { TemplateValidator } from '@/lib/template-factory/validator';
import { QualityScorer } from '@/lib/template-factory/quality-scorer';
import type { GenerationRequest, GeneratedTemplate } from '@/lib/template-factory/types';

const GenerateRequestSchema = z.object({
  knowledgePointId: z.string(),
  count: z.number().min(1).max(10).default(3),
  structures: z.array(z.enum(['linear', 'nested', 'multi_equation', 'constraint_chain'])).optional(),
  depths: z.array(z.number().min(1).max(4)).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { knowledgePointId, count, structures, depths } = parsed.data;

    // Look up the knowledge point
    const knowledgePoint = await prisma.knowledgePoint.findUnique({
      where: { id: knowledgePointId },
      include: { chapter: { include: { textbook: true } } },
    });

    if (!knowledgePoint) {
      return NextResponse.json(
        { error: 'Knowledge point not found' },
        { status: 404 }
      );
    }

    // Build generation request
    const genRequest: GenerationRequest = {
      knowledgePoint: {
        id: knowledgePoint.id,
        name: knowledgePoint.name,
      },
      targetStructures: (structures as GenerationRequest['targetStructures']) || ['linear'],
      targetDepths: (depths as GenerationRequest['targetDepths']) || [1, 2],
      count,
      context: {
        textbook: knowledgePoint.chapter?.textbook?.name,
        grade: knowledgePoint.chapter?.textbook?.grade || 7,
        relatedConcepts: [],
      },
    };

    // Initialize LLM client
    const llm = new LLMClient({
      model: (process.env.LLM_MODEL as 'gemini-2.5-flash' | 'gemini-2.5-pro') || 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY || '',
    });

    // Initialize components
    const generator = new TemplateGenerator(llm);
    const validator = new TemplateValidator(llm);
    const scorer = new QualityScorer();

    // Generate templates
    const generationResult = await generator.generate(genRequest);

    // Validate generated templates
    const validations = await validator.validateBatch(
      generationResult.templates as GeneratedTemplate[],
      { knowledgePoint: knowledgePoint.name, grade: genRequest.context.grade }
    );

    // Score and categorize templates
    let approvedCount = 0;
    let needsReviewCount = 0;
    let rejectedCount = 0;

    const templates = generationResult.templates.map((t, i) => {
      const validation = validations[i];
      const score = scorer.calculate(validation);
      const decision = scorer.shouldAutoApprove(score);

      if (decision.approve) {
        approvedCount++;
      } else if (decision.queue) {
        needsReviewCount++;
      } else {
        rejectedCount++;
      }

      return {
        name: t.name,
        validationResult: validation,
        needsReview: !decision.approve,
      };
    });

    return NextResponse.json({
      generationId: generationResult.generationId,
      status: 'completed',
      templates,
      summary: {
        total: generationResult.summary.total,
        approved: approvedCount,
        needsReview: needsReviewCount,
        rejected: rejectedCount,
      },
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Generation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
