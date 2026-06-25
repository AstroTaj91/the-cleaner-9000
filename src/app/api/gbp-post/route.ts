import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const RESIDENTIAL_TEMPLATES = [
  "Need a spotless home? Our professional team at [City] House Cleaning Services is here to help! We specialize in deep cleaning, move-in/out services, and recurring maintenance. With premier [City] house cleaning from our certified, local crews, you can sit back and relax. Let us handle the dust and grime. Book your next [City] house cleaning today and experience the difference!",
  "Experience the joy of coming home to a sparkling clean house. [City] House Cleaning Services offers customized residential cleaning plans. Our [City] house cleaning team is fully insured, background-checked, and highly rated. Enjoy a healthier living environment with our detailed sanitization. Schedule your professional [City] house cleaning today to lock in your slot!",
  "Are you struggling to keep up with chores? Let [City] House Cleaning Services take the burden off your shoulders. We provide deep cleans, carpet washing, and general maintenance. A professional [City] house cleaning ensures that every corner of your home is sanitized. Trust our local [City] house cleaning specialists to get the job done right!"
];

const COMMERCIAL_TEMPLATES = [
  "Keep your workplace pristine and professional. Our dedicated team at [City] Commercial Cleaning Services provides custom office cleaning, sanitization, and janitorial solutions for local businesses in [City]. Keep your employees healthy and impress your clients. Schedule a professional [City] commercial cleaning walkthrough today!",
  "Looking for reliable janitorial services? [City] Commercial Cleaning Services handles offices, medical facilities, and retail stores in [City]. Our background-checked [City] commercial cleaning staff keeps your premises safe and clean. Contact us today for a free custom commercial cleaning quote!",
  "A clean workspace boosts productivity and safety. [City] Commercial Cleaning Services offers comprehensive janitorial and building cleaning contracts across [City]. We specialize in floor maintenance, window washing, and office sanitation. Partner with our reliable [City] commercial cleaning team today!"
];

const CONSTRUCTION_TEMPLATES = [
  "Renovations finished? Don't let dust and debris ruin your hard work. [City] Construction Cleanup specializes in final cleans, rough cleans, and detailed renovation cleaning in [City]. Let our expert team prepare your site for handover. Get a premier [City] construction cleanup quote today!",
  "Get your building or home ready for occupancy. [City] Construction Cleanup offers thorough post-construction cleaning services for builders, contractors, and homeowners in [City]. Fully insured and safe. Contact us today for a quick [City] construction cleanup site inspection and booking!",
  "From rough debris removal to the final sparkling clean, [City] Construction Cleanup is the GTA's trusted partner for builders. We handle post-renovation dust, sticker removal, and deep sanitation in [City]. Book your professional [City] construction cleanup today to meet your handover deadline!"
];

export async function POST(request: Request) {
  try {
    const { city, gbp_listing_id, service_type } = await request.json();

    if (!city) {
      return NextResponse.json(
        { error: 'City is required.' },
        { status: 400 }
      );
    }

    const type = service_type || 'residential';
    let promptText = '';
    let fallbackTemplates = RESIDENTIAL_TEMPLATES;
    let phrase = `${city.toLowerCase()} house cleaning`;

    if (type === 'commercial') {
      promptText = `Write a Google Business Profile update for a commercial building and office cleaning company in ${city}. Naturally include the phrase '${city} commercial cleaning' or '${city} office cleaning' 2-3 times. Keep it under 750 characters. Do not output anything other than the post content.`;
      fallbackTemplates = COMMERCIAL_TEMPLATES;
      phrase = `${city.toLowerCase()} commercial cleaning`;
    } else if (type === 'construction') {
      promptText = `Write a Google Business Profile update for a post-construction and renovation cleanup company in ${city}. Naturally include the phrase '${city} construction cleanup' or '${city} post-construction cleaning' 2-3 times. Keep it under 750 characters. Do not output anything other than the post content.`;
      fallbackTemplates = CONSTRUCTION_TEMPLATES;
      phrase = `${city.toLowerCase()} construction cleanup`;
    } else {
      promptText = `Write a Google Business Profile update for a residential house cleaning company in ${city}. Naturally include the phrase '${city} house cleaning' 2-3 times. Keep it under 750 characters. Do not output anything other than the post content.`;
      fallbackTemplates = RESIDENTIAL_TEMPLATES;
      phrase = `${city.toLowerCase()} house cleaning`;
    }
    
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
      const randomIndex = Math.floor(Math.random() * fallbackTemplates.length);
      const template = fallbackTemplates[randomIndex];
      generatedPost = template.replace(/\[City\]/g, city);
    }

    // Double-check constraints
    const charCount = generatedPost.length;
    const occurrences = (generatedPost.toLowerCase().match(new RegExp(phrase, 'g')) || []).length;

    // Simulate Google Business Profile API localPost publishing payload
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
