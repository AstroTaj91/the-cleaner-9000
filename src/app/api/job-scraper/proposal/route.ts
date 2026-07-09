import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

interface ProposalRequestBody {
  title: string;
  description: string;
  location: string;
  pay: string;
  service_type: 'residential' | 'commercial' | 'construction';
  source: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProposalRequestBody;
    const { title, description, location, pay, service_type, source } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Job title and description are required.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    let usedAI = false;
    let resultJson = {
      proposal: '',
      recommended_wholesale_payout: 0,
      margin_analysis: '',
      strategy_tips: [] as string[]
    };

    if (apiKey && apiKey !== 'your_openai_api_key') {
      try {
        const promptText = `
You are the lead bidding strategist for Velch Cleaning Services (a premium cleaning brand operating in the Greater Toronto Area).
Analyze this scraped job listing:
- Title: "${title}"
- Source: "${source}"
- Location: "${location}"
- Stated Pay/Budget: "${pay}"
- Category: "${service_type}"
- Description: "${description}"

Apply the Velch Wholesale Arbitrage rules:
- Velch Standard Wholesale/Retail rates are:
  * 1 Bed/1 Bath = $85 wholesale (vs $140 retail)
  * 2 Bed/1 Bath = $115 wholesale (vs $190 retail)
  * 3 Bed/2 Bath = $155 wholesale (vs $250 retail)
  * 4 Bed/2 Bath = $195 wholesale (vs $310 retail)
  * Deep Clean add-on = +$35 wholesale (vs +$70 retail)
- If the stated pay is a custom amount, recommend a wholesale contractor payout that targets roughly 60% of the stated budget (a 40% margin for us) or matches the closest Velch size tier.

Generate:
1. A brief, professional, highly persuasive response draft (proposal) that the operator can copy and paste to message the client. Address specific details in the description (e.g. drywall dust, appliance cleaning, medical grade sanitization, WSIB insurance, safety shoes). Sign off as "Taj, Dispatch Manager at Velch Cleaning Services". Keep it under 800 characters.
2. A recommended wholesale contractor payout (in CAD dollars, as a number).
3. A brief margin analysis explaining the pricing logic.
4. A list of 3-4 strategic bid tips/questions for the operator.

Return ONLY a valid JSON object matching the following structure (no markdown formatting, no code blocks):
{
  "proposal": "string containing the response message",
  "recommended_wholesale_payout": number,
  "margin_analysis": "string containing margin and cost reasoning",
  "strategy_tips": ["string containing tip 1", "string containing tip 2", "string containing tip 3"]
}
`;

        const { text } = await generateText({
          model: openai('gpt-4o'),
          prompt: promptText,
          maxOutputTokens: 600,
          temperature: 0.7,
        });

        // Clean up text in case of markdown wrapping
        const cleanText = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
        resultJson = JSON.parse(cleanText);
        usedAI = true;
      } catch (aiError) {
        console.error('AI proposal generation failed, falling back to heuristics:', aiError);
      }
    }

    // Heuristics Fallback if AI key is missing or failed
    if (!usedAI || !resultJson.proposal) {
      // Determine flat rate budget
      let budgetVal = 200;
      const budgetMatch = pay.match(/\$?(\d+)/);
      if (budgetMatch) {
        budgetVal = parseInt(budgetMatch[1], 10);
      }

      // Calculate 60% wholesale payout
      const suggestedWholesale = Math.round(budgetVal * 0.6);
      
      const cleanLocation = location || 'the GTA';
      const cleanType = service_type || 'residential';
      
      let proposalText = `Hi there! I saw your posting for the cleaning contract in ${cleanLocation}. Our professional team at Velch Cleaning Services is fully insured, background-checked, and specializes in high-quality ${cleanType} cleaning. We have experienced crews in your area who can bring all necessary supplies and handle this right away. We would love to discuss the details and provide a firm quote. Looking forward to connecting!\n\nBest regards,\nTaj, Dispatch Manager at Velch Cleaning Services`;
      
      if (cleanType === 'construction') {
        proposalText = `Hi! I saw your post-construction clean request in ${cleanLocation}. Our crew at Velch Construction Cleanup specializes in final handover detailing—removing fine drywall dust, paint splatters, and polishing fixtures. Our team has full WSIB coverage and PPE. We can start immediately to ensure your handover goes smoothly.\n\nBest regards,\nTaj, Dispatch Manager at Velch Cleaning Services`;
      } else if (cleanType === 'commercial') {
        proposalText = `Hello! Regarding the commercial cleaning gig in ${cleanLocation}, Velch Commercial Services offers reliable office and building maintenance. Our staff is fully bonded, trained in disinfection protocols, and we provide detailed schedules. We'd love to inspect the site and finalize a contract.\n\nBest regards,\nTaj, Dispatch Manager at Velch Cleaning Services`;
      }

      resultJson = {
        proposal: proposalText,
        recommended_wholesale_payout: suggestedWholesale,
        margin_analysis: `Calculated wholesale contractor cost at 60% of target budget ($${budgetVal}) to secure a 40% margin ($${budgetVal - suggestedWholesale} gross profit).`,
        strategy_tips: [
          `Ask the client if they require eco-friendly cleaning supplies or special equipment.`,
          `Verify access instructions (lockbox code or on-site contact person).`,
          `Confirm whether parking is provided or needs to be reimbursed.`,
          `Ensure contractor has valid liability insurance verified before dispatch.`
        ]
      };
    }

    return NextResponse.json({
      success: true,
      usedAI,
      ...resultJson
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in job proposal API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
