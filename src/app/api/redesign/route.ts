import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export async function POST(req: NextRequest) {
    try {
        const { image, prompt, style } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'Se requiere una imagen' }, { status: 400 });
        }

        const apiKey = process.env.REPLICATE_API_TOKEN;
        if (!apiKey) {
            return NextResponse.json({
                error: 'API key de Replicate no configurada. Agregá REPLICATE_API_TOKEN en .env.local'
            }, { status: 500 });
        }

        const replicate = new Replicate({ auth: apiKey });

        console.log(`🎨 Generating redesign: style=${style}, prompt="${prompt?.substring(0, 60)}..."`);

        // Use adirik/interior-design — $0.007/run, ~8 seconds
        const output = await replicate.run(
            "adirik/interior-design:76604baddc85b1b4616e1c6475571571f394ea17e1e6e87a72f84e48f71575e0",
            {
                input: {
                    image,
                    prompt: prompt || 'A beautifully redesigned room with modern interior design',
                    guidance_scale: 15,
                    negative_prompt: 'lowres, watermark, banner, logo, text, blurry, ugly, deformed, noisy, low quality',
                    num_inference_steps: 50,
                }
            }
        );

        console.log('✅ Redesign generated successfully');

        // output is a URL or an array with one URL
        const resultUrl = Array.isArray(output) ? output[0] : output;

        return NextResponse.json({
            success: true,
            result: resultUrl,
        });

    } catch (error: any) {
        console.error('❌ Redesign failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
