// Rule Schema & Operator Registry for Deep Multi-Level Cascading Rule Editor

export const RULE_CATEGORIES = [
  { id: 'indicator', label: 'Indicator & Oscillator' },
  { id: 'candle_pattern', label: 'Candlestick Pattern' },
  { id: 'price_action', label: 'Price Action & Structure' },
  { id: 'session_time', label: 'Session & Timing' },
  { id: 'account_state', label: 'Account State & Risk' },
];

export const RULE_ITEMS_BY_CATEGORY = {
  indicator: [
    { id: 'RSI', label: 'RSI (Relative Strength Index)' },
    { id: 'EMA', label: 'EMA (Exponential Moving Avg)' },
    { id: 'SMA', label: 'SMA (Simple Moving Avg)' },
    { id: 'MACD', label: 'MACD (Moving Avg Convergence Divergence)' },
    { id: 'BollingerBands', label: 'Bollinger Bands' },
    { id: 'ATR', label: 'ATR (Average True Range)' },
    { id: 'Stochastic', label: 'Stochastic Oscillator' },
    { id: 'ADX', label: 'ADX (Average Directional Index)' },
    { id: 'Alligator', label: 'Bill Williams Alligator' },
    { id: 'Ichimoku', label: 'Ichimoku Kinko Hyo' },
    { id: 'VWAP', label: 'VWAP (Volume Weighted Avg Price)' },
    { id: 'ParabolicSAR', label: 'Parabolic SAR' },
    { id: 'PivotPoints', label: 'Pivot Points (Classic / Camarilla)' },
  ],
  candle_pattern: [
    { id: 'Hammer', label: 'Hammer (Bullish Pinbar)' },
    { id: 'BullishEngulfing', label: 'Bullish Engulfing' },
    { id: 'BearishEngulfing', label: 'Bearish Engulfing' },
    { id: 'ShootingStar', label: 'Shooting Star (Bearish Pinbar)' },
    { id: 'Doji', label: 'Doji (Neutral Indecision)' },
    { id: 'MorningStar', label: 'Morning Star (3-Bar Bullish Reversal)' },
    { id: 'EveningStar', label: 'Evening Star (3-Bar Bearish Reversal)' },
    { id: 'InsideBar', label: 'Inside Bar (Consolidation / Breakout)' },
    { id: 'Marubozu', label: 'Marubozu (Strong Momentum Candle)' },
    { id: 'IndecisionCandle', label: 'Indecision Candle (Custom Range Follow-up)' },
  ],
  price_action: [
    { id: 'CurrentPrice', label: 'Current Live Price' },
    { id: 'SwingHigh', label: 'Recent Swing High' },
    { id: 'SwingLow', label: 'Recent Swing Low' },
    { id: 'SupportResistanceZone', label: 'Key Support / Resistance Zone' },
    { id: 'FairValueGap', label: 'Fair Value Gap (FVG / Imbalance)' },
    { id: 'OrderBlock', label: 'Institutional Order Block (OB)' },
    { id: 'LiquiditySweep', label: 'Session Liquidity Sweep (BSL / SSL)' },
  ],
  session_time: [
    { id: 'CurrentSession', label: 'Trading Session (London / NY / Asian)' },
    { id: 'Killzone', label: 'ICT Killzone Window' },
    { id: 'DayOfWeek', label: 'Day of the Week' },
    { id: 'NewsBlackout', label: 'USD High-Impact News Filter' },
  ],
  account_state: [
    { id: 'OpenTradesCount', label: 'Active Open Positions Count' },
    { id: 'DailyPnLPercent', label: 'Today P&L Drawdown %' },
    { id: 'AccountBalance', label: 'Account Balance / Equity' },
    { id: 'CurrentSpread', label: 'Live Broker Spread (pips)' },
  ],
};

export const OPERATOR_REGISTRY = {
  // --- INDICATORS ---
  RSI: {
    subFields: [],
    operators: [
      { id: 'less_than', label: 'is less than (<)', valueType: 'number', defaultVal: 38 },
      { id: 'greater_than', label: 'is greater than (>)', valueType: 'number', defaultVal: 62 },
      { id: 'crosses_above', label: 'crosses above threshold', valueType: 'number', defaultVal: 30 },
      { id: 'crosses_below', label: 'crosses below threshold', valueType: 'number', defaultVal: 70 },
      { id: 'in_bullish_divergence', label: 'in Bullish Divergence with price (higher RSI, lower price)', valueType: 'none' },
      { id: 'in_bearish_divergence', label: 'in Bearish Divergence with price (lower RSI, higher price)', valueType: 'none' },
    ],
  },
  Alligator: {
    subFields: [
      { id: 'lips', label: 'Lips (Green Line, 5 period)' },
      { id: 'teeth', label: 'Teeth (Red Line, 8 period)' },
      { id: 'jaw', label: 'Jaw (Blue Line, 13 period)' },
      { id: 'all_lines', label: 'All 3 Lines Relationship' },
    ],
    operators: [
      { id: 'lips_crosses_above_teeth', label: 'Lips crosses above Teeth (Bullish trigger)', valueType: 'none' },
      { id: 'lips_crosses_below_teeth', label: 'Lips crosses below Teeth (Bearish trigger)', valueType: 'none' },
      { id: 'teeth_crosses_above_jaw', label: 'Teeth crosses above Jaw (Trend alignment)', valueType: 'none' },
      { id: 'teeth_crosses_below_jaw', label: 'Teeth crosses below Jaw (Trend alignment)', valueType: 'none' },
      { id: 'lines_intertwined_sleeping', label: 'Lines are intertwined (Sleeping / Chop - Do not trade)', valueType: 'none' },
      { id: 'lines_fanned_out_awake', label: 'Lines are fanned out (Awake / Strong Trend Expansion)', valueType: 'none' },
    ],
  },
  MACD: {
    subFields: [
      { id: 'macd_line', label: 'MACD Line (Fast 12 - Slow 26)' },
      { id: 'signal_line', label: 'Signal Line (EMA 9)' },
      { id: 'histogram', label: 'Histogram' },
    ],
    operators: [
      { id: 'macd_crosses_above_signal', label: 'MACD Line crosses above Signal Line (Bullish)', valueType: 'none' },
      { id: 'macd_crosses_below_signal', label: 'MACD Line crosses below Signal Line (Bearish)', valueType: 'none' },
      { id: 'histogram_greater_than_zero', label: 'Histogram is greater than 0 (Positive Momentum)', valueType: 'none' },
      { id: 'histogram_less_than_zero', label: 'Histogram is less than 0 (Negative Momentum)', valueType: 'none' },
      { id: 'histogram_increasing', label: 'Histogram is expanding / increasing in size', valueType: 'none' },
      { id: 'histogram_decreasing', label: 'Histogram is contracting / losing momentum', valueType: 'none' },
    ],
  },
  BollingerBands: {
    subFields: [
      { id: 'upper_band', label: 'Upper Band (+2 StdDev)' },
      { id: 'middle_band', label: 'Middle Band (SMA 20)' },
      { id: 'lower_band', label: 'Lower Band (-2 StdDev)' },
      { id: 'band_width', label: 'Band Width (Volatility)' },
    ],
    operators: [
      { id: 'price_touches_upper_band', label: 'Price touches / penetrates Upper Band (Overbought)', valueType: 'none' },
      { id: 'price_touches_lower_band', label: 'Price touches / penetrates Lower Band (Oversold)', valueType: 'none' },
      { id: 'price_crosses_middle_band', label: 'Price crosses Middle Band (Mean Reversion)', valueType: 'none' },
      { id: 'bands_squeezing_low_volatility', label: 'Bands squeezing (Low width / Impending breakout)', valueType: 'none' },
      { id: 'bands_expanding', label: 'Bands expanding with volume (Breakout in progress)', valueType: 'none' },
    ],
  },
  EMA: {
    subFields: [],
    operators: [
      { id: 'price_above_ema', label: 'Price is above EMA (Bullish trend)', valueType: 'none' },
      { id: 'price_below_ema', label: 'Price is below EMA (Bearish trend)', valueType: 'none' },
      { id: 'price_pullback_to_ema', label: 'Price pulls back to retest EMA zone', valueType: 'none' },
      { id: 'crosses_above_field', label: 'crosses above another Field', valueType: 'compare_field', defaultCompare: 'EMA_200' },
      { id: 'crosses_below_field', label: 'crosses below another Field', valueType: 'compare_field', defaultCompare: 'EMA_200' },
    ],
  },
  SMA: {
    subFields: [],
    operators: [
      { id: 'price_above_sma', label: 'Price is above SMA', valueType: 'none' },
      { id: 'price_below_sma', label: 'Price is below SMA', valueType: 'none' },
      { id: 'crosses_above_field', label: 'crosses above another Field', valueType: 'compare_field', defaultCompare: 'SMA_200' },
      { id: 'crosses_below_field', label: 'crosses below another Field', valueType: 'compare_field', defaultCompare: 'SMA_200' },
    ],
  },
  ATR: {
    subFields: [],
    operators: [
      { id: 'greater_than', label: 'is greater than (pips)', valueType: 'number', defaultVal: 15.0 },
      { id: 'less_than', label: 'is less than (pips)', valueType: 'number', defaultVal: 8.0 },
      { id: 'expanding', label: 'Volatility is expanding (Higher ATR)', valueType: 'none' },
    ],
  },
  Stochastic: {
    subFields: [
      { id: 'k_line', label: '%K Fast Line' },
      { id: 'd_line', label: '%D Slow Line' },
    ],
    operators: [
      { id: 'k_crosses_above_d', label: '%K crosses above %D in Oversold zone (<20)', valueType: 'none' },
      { id: 'k_crosses_below_d', label: '%K crosses below %D in Overbought zone (>80)', valueType: 'none' },
      { id: 'less_than', label: '%K is less than', valueType: 'number', defaultVal: 20 },
      { id: 'greater_than', label: '%K is greater than', valueType: 'number', defaultVal: 80 },
    ],
  },
  ADX: {
    subFields: [],
    operators: [
      { id: 'adx_above_threshold', label: 'ADX is greater than (Strong Trend)', valueType: 'number', defaultVal: 25 },
      { id: 'adx_below_threshold', label: 'ADX is less than (Weak / Ranging)', valueType: 'number', defaultVal: 20 },
      { id: 'plus_di_above_minus_di', label: '+DI is above -DI (Bullish Dominance)', valueType: 'none' },
      { id: 'minus_di_above_plus_di', label: '-DI is above +DI (Bearish Dominance)', valueType: 'none' },
    ],
  },
  Ichimoku: {
    subFields: [
      { id: 'tenkan', label: 'Tenkan-sen (Conversion Line)' },
      { id: 'kijun', label: 'Kijun-sen (Base Line)' },
      { id: 'kumo', label: 'Kumo (Cloud)' },
    ],
    operators: [
      { id: 'price_above_cloud', label: 'Price is above Kumo Cloud (Bullish)', valueType: 'none' },
      { id: 'price_below_cloud', label: 'Price is below Kumo Cloud (Bearish)', valueType: 'none' },
      { id: 'tenkan_crosses_above_kijun', label: 'Tenkan crosses above Kijun (Bullish TK Cross)', valueType: 'none' },
      { id: 'tenkan_crosses_below_kijun', label: 'Tenkan crosses below Kijun (Bearish TK Cross)', valueType: 'none' },
    ],
  },
  VWAP: {
    subFields: [],
    operators: [
      { id: 'price_above_vwap', label: 'Price is above Daily VWAP (Bullish bias)', valueType: 'none' },
      { id: 'price_below_vwap', label: 'Price is below Daily VWAP (Bearish bias)', valueType: 'none' },
      { id: 'price_retests_vwap', label: 'Price bounces / retests VWAP level', valueType: 'none' },
    ],
  },
  ParabolicSAR: {
    subFields: [],
    operators: [
      { id: 'sar_flips_below_price', label: 'SAR flips below price (Bullish trigger)', valueType: 'none' },
      { id: 'sar_flips_above_price', label: 'SAR flips above price (Bearish trigger)', valueType: 'none' },
    ],
  },
  PivotPoints: {
    subFields: [
      { id: 'pp', label: 'Central Pivot Point (PP)' },
      { id: 's1', label: 'Support 1 (S1)' },
      { id: 's2', label: 'Support 2 (S2)' },
      { id: 'r1', label: 'Resistance 1 (R1)' },
      { id: 'r2', label: 'Resistance 2 (R2)' },
    ],
    operators: [
      { id: 'price_above_pivot', label: 'Price is trading above Central Pivot', valueType: 'none' },
      { id: 'price_below_pivot', label: 'Price is trading below Central Pivot', valueType: 'none' },
      { id: 'price_touches_support', label: 'Price tests / touches Support level', valueType: 'none' },
      { id: 'price_touches_resistance', label: 'Price tests / touches Resistance level', valueType: 'none' },
    ],
  },

  // --- CANDLE PATTERNS ---
  Hammer: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (Long lower shadow >= 2x body)', valueType: 'none' },
      { id: 'is_not_detected', label: 'is NOT detected', valueType: 'none' },
    ],
  },
  BullishEngulfing: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (Green body fully engulfs prior red body)', valueType: 'none' },
      { id: 'is_not_detected', label: 'is NOT detected', valueType: 'none' },
    ],
  },
  BearishEngulfing: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (Red body fully engulfs prior green body)', valueType: 'none' },
      { id: 'is_not_detected', label: 'is NOT detected', valueType: 'none' },
    ],
  },
  ShootingStar: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (Long upper wick at resistance)', valueType: 'none' },
      { id: 'is_not_detected', label: 'is NOT detected', valueType: 'none' },
    ],
  },
  Doji: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (Close equal to Open / Tight body)', valueType: 'none' },
      { id: 'is_not_detected', label: 'is NOT detected', valueType: 'none' },
    ],
  },
  MorningStar: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (3-bar bullish reversal sequence)', valueType: 'none' },
    ],
  },
  EveningStar: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (3-bar bearish reversal sequence)', valueType: 'none' },
    ],
  },
  InsideBar: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (High/Low inside prior bar range)', valueType: 'none' },
    ],
  },
  Marubozu: {
    subFields: [],
    operators: [
      { id: 'is_detected', label: 'is detected (Full solid body, no wicks)', valueType: 'none' },
    ],
  },
  IndecisionCandle: {
    subFields: [
      { id: 'next_candle_close', label: 'Next Candle Confirmation Close' },
    ],
    operators: [
      { id: 'closes_above_candle_high', label: 'closes above this candle\'s high (Bullish breakout)', valueType: 'none' },
      { id: 'closes_below_candle_low', label: 'closes below this candle\'s low (Bearish breakout)', valueType: 'none' },
      { id: 'closes_within_candle_range', label: 'closes within this candle\'s range (Continued consolidation)', valueType: 'none' },
    ],
  },

  // --- PRICE ACTION & STRUCTURE ---
  CurrentPrice: {
    subFields: [],
    operators: [
      { id: 'greater_than', label: 'is greater than level', valueType: 'number', defaultVal: 2735.0 },
      { id: 'less_than', label: 'is less than level', valueType: 'number', defaultVal: 2700.0 },
      { id: 'crosses_above', label: 'crosses above level', valueType: 'number', defaultVal: 2750.0 },
    ],
  },
  SwingHigh: {
    subFields: [],
    operators: [
      { id: 'swept_and_rejected', label: 'swept liquidity above swing high and rejected', valueType: 'none' },
      { id: 'broken_bullish_bos', label: 'broken with full candle close (Break of Structure BOS)', valueType: 'none' },
    ],
  },
  SwingLow: {
    subFields: [],
    operators: [
      { id: 'swept_and_rejected', label: 'swept liquidity below swing low and rejected', valueType: 'none' },
      { id: 'broken_bearish_bos', label: 'broken with full candle close (Break of Structure BOS)', valueType: 'none' },
    ],
  },
  SupportResistanceZone: {
    subFields: [],
    operators: [
      { id: 'price_enters_support_zone', label: 'Price enters key Support zone', valueType: 'none' },
      { id: 'price_enters_resistance_zone', label: 'Price enters key Resistance zone', valueType: 'none' },
    ],
  },
  FairValueGap: {
    subFields: [],
    operators: [
      { id: 'price_enters_bullish_fvg', label: 'Price mitigates Bullish FVG zone', valueType: 'none' },
      { id: 'price_enters_bearish_fvg', label: 'Price mitigates Bearish FVG zone', valueType: 'none' },
    ],
  },
  OrderBlock: {
    subFields: [],
    operators: [
      { id: 'price_retests_bullish_ob', label: 'Price retests unmitigated Bullish Order Block', valueType: 'none' },
      { id: 'price_retests_bearish_ob', label: 'Price retests unmitigated Bearish Order Block', valueType: 'none' },
    ],
  },
  LiquiditySweep: {
    subFields: [],
    operators: [
      { id: 'asian_high_swept', label: 'Asian Session High swept during London Open', valueType: 'none' },
      { id: 'asian_low_swept', label: 'Asian Session Low swept during London Open', valueType: 'none' },
    ],
  },

  // --- SESSION & TIMING ---
  CurrentSession: {
    subFields: [],
    operators: [
      { id: 'is_london_open', label: 'is London Open (07:00 - 10:00 UTC)', valueType: 'none' },
      { id: 'is_ny_open', label: 'is New York Open (12:00 - 15:00 UTC)', valueType: 'none' },
      { id: 'is_asian_session', label: 'is Asian Session (00:00 - 06:00 UTC)', valueType: 'none' },
    ],
  },
  Killzone: {
    subFields: [],
    operators: [
      { id: 'is_active', label: 'is actively inside ICT Killzone window', valueType: 'none' },
      { id: 'is_inactive', label: 'is outside Killzone window', valueType: 'none' },
    ],
  },
  DayOfWeek: {
    subFields: [],
    operators: [
      { id: 'is_tuesday_wednesday_thursday', label: 'is Mid-Week Prime Day (Tue / Wed / Thu)', valueType: 'none' },
      { id: 'is_monday', label: 'is Monday (Range build)', valueType: 'none' },
      { id: 'is_friday', label: 'is Friday (Profit taking)', valueType: 'none' },
    ],
  },
  NewsBlackout: {
    subFields: [],
    operators: [
      { id: 'no_high_impact_news_30m', label: 'No USD High-Impact News within 30 minutes', valueType: 'none' },
      { id: 'news_blackout_active', label: 'News blackout is currently active (Do not trade)', valueType: 'none' },
    ],
  },

  // --- ACCOUNT STATE & RISK ---
  OpenTradesCount: {
    subFields: [],
    operators: [
      { id: 'less_than', label: 'is less than (<)', valueType: 'number', defaultVal: 2 },
      { id: 'equal_to_zero', label: 'is 0 (No open trades)', valueType: 'none' },
    ],
  },
  DailyPnLPercent: {
    subFields: [],
    operators: [
      { id: 'drawdown_less_than', label: 'Daily Drawdown is less than (<)', valueType: 'number', defaultVal: 3.0 },
    ],
  },
  AccountBalance: {
    subFields: [],
    operators: [
      { id: 'greater_than', label: 'is greater than ($)', valueType: 'number', defaultVal: 100.0 },
    ],
  },
  CurrentSpread: {
    subFields: [],
    operators: [
      { id: 'less_than_pips', label: 'is less than threshold (pips)', valueType: 'number', defaultVal: 3.0 },
    ],
  },
};

export const ACTION_TARGETS = [
  { id: 'entry_long_and', label: 'Add to Entry Long (AND)' },
  { id: 'entry_long_or', label: 'Add to Entry Long (OR)' },
  { id: 'entry_short_and', label: 'Add to Entry Short (AND)' },
  { id: 'entry_short_or', label: 'Add to Entry Short (OR)' },
  { id: 'exit_condition', label: 'Add to Exit / Invalidation' },
  { id: 'alert_only', label: 'Trigger Alert Only (No Trade)' },
];

export const TIMEFRAMES = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: '4h', label: '4h' },
  { id: '1d', label: '1d' },
];
