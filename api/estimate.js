export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pdf } = req.body;

        if (!pdf) {
            return res.status(400).json({ error: 'No PDF provided' });
        }

        const systemPrompt = `You are an estimating assistant for Patriots Roofing. Extract data from GAF QuickMeasure PDF reports and calculate 6 pricing options.

## EXTRACTION RULES

From the Summary page, capture:
- Property Address (exactly as shown)
- Total Roof Area (sq ft)
- Pitch breakdown (pitch values and their areas/percentages)
- Suggested Waste % (look for "Suggested" label above a waste column)

If no "Suggested" waste is marked, default to 10%.

## PITCH CATEGORIZATION

Map all pitches into three buckets:
- Mod Bit: 0/12 through 2/12
- 3/12 Full I&W: exactly 3/12
- 4/12 & Up: 4/12 and steeper

Calculate the percentage of total roof area for each bucket. These must sum to 100%.

## CALCULATION STEPS

1. Base Squares = Total Roof Area ÷ 100
2. Squares + Waste = Base Squares × (1 + Waste%)
3. Waste Squares = Squares + Waste - Base Squares

For each pitch bucket:
- Base squares for bucket = Base Squares × bucket percentage
- Waste share = (bucket base squares ÷ total base squares) × Waste Squares
- Raw total = base squares + waste share

## THIRDS ROUNDING (CRITICAL)

For each pitch bucket's raw total, round to nearest .33, .66, or whole number:
- If fractional part = 0 → keep as-is
- If fractional part ≤ 0.165 → round to whole number
- If fractional part > 0.165 and ≤ 0.495 → round to .33
- If fractional part > 0.495 and ≤ 0.825 → round to .66
- If fractional part > 0.825 → round up to next whole number

## PRICING CALCULATION

Base Costs:
- Material: $252/sq
- Labor: $135/sq
- Base Rate: $387/sq

Pitch Multipliers (applied to base rate):
- Mod Bit (0-2/12): × 1.10
- 3/12: × 1.07
- 4/12+: × 1.00

Margin Multipliers:
- Systems+: × 1.54 (35% margin)
- Silver: × 1.5625 (36% margin)
- Gold: × 1.67 (40% margin)

Formula per pitch bucket:
Price = Rounded Squares × Base Rate × Pitch Multiplier × Margin Multiplier

UHDZ Pricing:
UHDZ = HDZ × 1.10

## OUTPUT FORMAT

You must respond with ONLY a valid JSON object, no other text. Use this exact structure:

{
    "address": "string - property address exactly as shown, or 'Not shown in report'",
    "totalArea": number,
    "baseSquares": number,
    "wastePercent": number,
    "wasteSource": "string - either 'Suggested' or 'Default'",
    "squaresWithWaste": number,
    "pitchBreakdown": {
        "modBit": { "percent": number, "squares": number },
        "threetwelve": { "percent": number, "squares": number },
        "fourplus": { "percent": number, "squares": number }
    },
    "pricing": {
        "hdz": {
            "systemsPlus": number,
            "silver": number,
            "gold": number
        },
        "uhdz": {
            "systemsPlus": number,
            "silver": number,
            "gold": number
        }
    },
    "flags": ["array of strings for any warnings like low-slope areas, multiple structures, etc."]
}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'document',
                                source: {
                                    type: 'base64',
                                    media_type: 'application/pdf',
                                    data: pdf,
                                },
                            },
                            {
                                type: 'text',
                                text: 'Extract the data from this GAF QuickMeasure report and calculate the 6 prices. Return ONLY the JSON object, no other text.',
                            },
                        ],
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', errorText);
            return res.status(500).json({ error: 'Failed to process PDF' });
        }

        const result = await response.json();
        const content = result.content[0].text;

        // Parse the JSON response
        let estimateData;
        try {
            // Remove any markdown code blocks if present
            const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
            estimateData = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('Failed to parse Claude response:', content);
            return res.status(500).json({ error: 'Failed to parse estimate data' });
        }

        return res.status(200).json(estimateData);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
