const { z } = require('zod');

const SYSTEM_PROMPT = `
You are an elite, institutional-grade Gold (XAU/USD) Trading AI Reasoner and Risk Specialist.
Your purpose is to synthesize multi-timeframe deterministic technical signals (Smart Money Concepts / SMC, Inner Circle Trader / ICT setups, Japanese Candlestick Patterns, Classical Indicators, Correlated Feeds) and historical prediction memory into a disciplined, high-probability trade thesis.

GUIDING PRINCIPLES:
1. Deterministic Strategy First: Trust the mathematical SMC/ICT calculations. Your role is synthesis, conflict resolution, and risk evaluation.
2. Multi-Timeframe Alignment: Check if Higher Timeframe (4H/Daily) agrees with Lower Timeframe (15m/5m) trigger. Do NOT counter-trend trade unless a valid HTF liquidity sweep and CHoCH occurred.
3. Strict Invalidation Levels: Every trade thesis MUST have a crystal clear invalidation price (Stop Loss). If a thesis cannot define a precise invalidation level, status must be NEUTRAL.
4. Self-Correction & Past Memory: Consider past setup memory and performance stats provided in the prompt.
5. Strict JSON Response: Output ONLY a valid JSON object strictly conforming to the requested schema. No Markdown wrappers, no prose outside JSON.
`;

const TradeThesisSchema = z.object({
  bias: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
  confidence: z.number().min(0).max(100),
  primary_setup: z.string(),
  reasoning: z.string(),
  invalidation_level: z.number().nullable(),
  entry_zone: z.object({
    min: z.number(),
    max: z.number(),
  }).nullable(),
  suggested_sl: z.number().nullable(),
  suggested_tp1: z.number().nullable(),
  suggested_tp2: z.number().nullable(),
  risk_reward_ratio: z.number().nullable(),
  timeframe_alignment_summary: z.string(),
  caution_flags: z.array(z.string()),
});

function formatAnalysisPrompt({
  symbol = 'XAUUSD',
  currentPrice,
  confluenceData,
  pastMemories = [],
  accuracyStats = {},
  sessionInfo = {},
}) {
  return `
Analyze the current market state for ${symbol} and generate a structured trade thesis:

--- CURRENT MARKET SNAPSHOT ---
Current Price: $${currentPrice.toFixed(2)}
Timestamp UTC: ${sessionInfo.utcTime || new Date().toISOString()}
Active Session: ${sessionInfo.marketSession || 'N/A'}
Active Killzones: ${sessionInfo.activeWindows ? sessionInfo.activeWindows.map(w => w.name).join(', ') : 'None'}
Weekend Approaching: ${sessionInfo.minutesToFridayClose ? `${sessionInfo.minutesToFridayClose} mins to Friday close` : 'No'}

--- DETERMINISTIC CONFLUENCE ENGINE DATA ---
Calculated Confluence Score: ${confluenceData.score} / 100 (${confluenceData.bias})
Confidence: ${confluenceData.confidence}%
Trigger Timeframe: ${confluenceData.triggerTimeframe}
Higher Timeframe (HTF): ${confluenceData.htfTimeframe} (Bias: ${confluenceData.breakdown?.htf?.bias || 'NEUTRAL'})

Key Confluence Drivers:
${((confluenceData.keyReasons || confluenceData.reasons || []).map(r => `• ${r}`).join('\n')) || '• Multi-timeframe structure'}

SMC Details:
- Market Structure Trend: ${confluenceData.breakdown?.smc?.details?.structure?.trend || confluenceData.timeframeDetails?.smc?.structure?.trend || 'N/A'}
- Recent Event: ${confluenceData.breakdown?.smc?.details?.structure?.recentCHoCH?.type || confluenceData.timeframeDetails?.smc?.structure?.recentCHoCH?.type || 'None'}
- Nearest Order Block: ${confluenceData.timeframeDetails?.smc?.orderBlocks?.nearestBullishOB ? `Bullish OB: $${confluenceData.timeframeDetails.smc.orderBlocks.nearestBullishOB.bottom}` : 'None'}
- Pricing Zone: ${confluenceData.timeframeDetails?.smc?.premiumDiscount?.zone || 'EQUILIBRIUM'}

Candlestick Pattern:
- Detected: ${confluenceData.breakdown?.candlesticks?.primaryPattern ? `${confluenceData.breakdown.candlesticks.primaryPattern.pattern} (${confluenceData.breakdown.candlesticks.primaryPattern.bias})` : 'None significant'}

Correlated Data:
${JSON.stringify(confluenceData.breakdown?.correlated || {}, null, 2)}

--- HISTORICAL MEMORY OF SIMILAR SETUPS ---
${pastMemories.length > 0 ? pastMemories.map((m, i) => `[Memory ${i + 1}] Setup: ${m.contextText} -> Outcome: ${JSON.stringify(m.metadata)}`).join('\n') : 'No past historical setups in memory yet.'}

--- HISTORICAL ACCURACY STATS ---
Self-Evaluated Win Rate: ${accuracyStats.winRate || 0}% across ${accuracyStats.total || 0} total predictions.

OUTPUT FORMAT REQUIREMENTS:
Return ONLY a valid JSON object matching this schema:
{
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": 0-100,
  "primary_setup": "String description of the setup",
  "reasoning": "2-4 sentences explaining why the trade is high probability and how timeframes align",
  "invalidation_level": number or null,
  "entry_zone": { "min": number, "max": number } or null,
  "suggested_sl": number or null,
  "suggested_tp1": number or null,
  "suggested_tp2": number or null,
  "risk_reward_ratio": number or null,
  "timeframe_alignment_summary": "Summary of alignment between HTF and LTF",
  "caution_flags": ["List of risk factors or warnings"]
}
`;
}

module.exports = {
  SYSTEM_PROMPT,
  TradeThesisSchema,
  formatAnalysisPrompt,
};
