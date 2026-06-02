import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const FALLBACK_TEMPLATES = [
  "Need a spotless home? Our professional team at [City] House Cleaning Services is here to help! We specialize in deep cleaning, move-in/out services, and recurring maintenance. With premier [City] house cleaning from our certified, local crews, you can sit back and relax. Let us handle the dust and grime. Book your next [City] house cleaning today and experience the difference!",
  "Experience the joy of coming home to a sparkling clean house. [City] House Cleaning Services offers customized residential cleaning plans. Our [City] house cleaning team is fully insured, background-checked, and highly rated. Enjoy a healthier living environment with our detailed sanitization. Schedule your professional [City] house cleaning today to lock in your slot!",
  "Are you struggling to keep up with chores? Let [City] House Cleaning Services take the burden off your shoulders. We provide deep cleans, carpet washing, and general maintenance. A professional [City] house cleaning ensures that every corner of your home is sanitized. Trust our local [City] house cleaning specialists to get the job done right!"
];

export async function POST(request: Request) {
  try {
    const { city, gbp_listing_id } = await request.json();

    if (!city) {
      return NextResponse.json(
        { error: 'City is required.' },
        { status: 400 }
      );
    }

    const promptText = `Write a Google Business Profile update for a house cleaning company in ${city}. Naturally include the phrase '${city} house cleaning' 2-3 times. Keep it under 750 characters. Do not output anything other than the post content.`;
    
    let generatedPost = '';
    let usedAI = false;

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey && apiKey !== 'your_openai_api_key') {
      try {
        const { text } = await generateText({
          model: openai('gpt-4o'),
          prompt: promptText,
          maxOutputTokens: 300,
          temperature: 0.7,
        });
        generatedPost = text.trim();
        usedAI = true;
      } catch (aiError) {
        console.warn('AI post generation failed, falling back to templates:', aiError);
      }
    }

    // Fallback if AI key is missing or failed
    if (!generatedPost) {
      // Pick a random template and replace [City]
      const randomIndex = Math.floor(Math.random() * FALLBACK_TEMPLATES.length);
      const template = FALLBACK_TEMPLATES[randomIndex];
      generatedPost = template.replace(/\[City\]/g, city);
    }

    // Double-check constraints
    const charCount = generatedPost.length;
    // Count exact occurrences of "[City] house cleaning" (case insensitive)
    const phrase = `${city.toLowerCase()} house cleaning`;
    const occurrences = (generatedPost.toLowerCase().match(new RegExp(phrase, 'g')) || []).length;

    // Simulate Google Business Profile API localPost publishing payload
    // According to GBusiness LocalPost API schema, localPosts are created on localPost resource path
    const mockGbpPayload = {
      languageCode: 'en-US',
      summary: generatedPost,
      callToAction: {
        actionType: 'BOOK',
        url: 'https://g.page/r/velch-mock-booking/review'
      },
      topicType: 'STANDARD'
    };

    return NextResponse.json({
      success: true,
      usedAI,
      city,
      gbp_listing_id: gbp_listing_id || 'mock_id',
      charCount,
      keywordOccurrences: occurrences,
      postContent: generatedPost,
      publishedPayload: mockGbpPayload
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in gbp-post API:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
