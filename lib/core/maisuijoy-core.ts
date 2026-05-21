/**
 * MaisuiJoy Core V6.2.1
 * Production Control Layer — Telemetry, Operator, Entropy
 *
 * Integrated from maisuijoy_core_v6.2.1.ts into the production codebase.
 * The Groq transcription resilience pattern is implemented in lib/ai/whisper.ts
 * (adapted to use the Groq SDK with iOS MIME-type compatibility preserved).
 */

// ============================================================================
// 1. PRODUCTION CONFIGURATION & FEATURE FLAGS
// ============================================================================

export interface MaisuiOperatorConfig {
  minConfidence:        number
  maxDriftLimitMs:      number
  entropyThreshold:     number
  interactionRateFloor: number
  uiLatencyCeiling:     number
  slidingWindowSize:    number
  groqTimeoutMs:        number
  groqMaxRetries:       number
}

export const DEFAULT_PRODUCTION_CONFIG: Readonly<MaisuiOperatorConfig> = {
  minConfidence:        0.15,
  maxDriftLimitMs:      86_400_000,  // 24-hour window
  entropyThreshold:     0.87,
  interactionRateFloor: 0.15,
  uiLatencyCeiling:     0.75,
  slidingWindowSize:    8,           // last 8 samples for variance
  groqTimeoutMs:        30_000,      // 30-second hard limit
  groqMaxRetries:       3,           // 3-tier backoff retry pipeline
}

// ============================================================================
// 2. CORE TYPES
// ============================================================================

export interface RawTelemetryInput {
  interactionRate:      number
  inputEntropy:         number
  uiLatencySensitivity: number
  timestamp:            number
}

export interface ControlSignal {
  readonly interactionRate:      number
  readonly inputEntropy:         number
  readonly uiLatencySensitivity: number
  readonly silenceGapVariance:   number
}

export type RenderMode =
  | 'interactive'
  | 'structural_only'
  | 'literal_only'
  | 'non_interactive'
  | 'flat_failure'

export interface IOTrace {
  readonly renderMode:              RenderMode
  readonly activeTokens:            string[]
  readonly passthroughChannelActive: boolean
  readonly reasonCode:              string
  readonly timestamp:               number
}

export interface GeneratorModel {
  readonly id:                  string
  readonly targetSemanticSpace: string
  execute(signal: ControlSignal): Omit<IOTrace, 'reasonCode'>
}

// ============================================================================
// 3. TELEMETRY SLIDING WINDOW (Paradox Resolution — V6.2.1 Fix #2)
// ============================================================================

export class TelemetrySlidingWindow {
  private buffer: RawTelemetryInput[] = []
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  public push(input: RawTelemetryInput): void {
    this.buffer.push(input)
    if (this.buffer.length > this.maxSize) this.buffer.shift()
  }

  public computeCurrentSignal(current: RawTelemetryInput): ControlSignal {
    this.push(current)
    return {
      interactionRate:      current.interactionRate,
      inputEntropy:         current.inputEntropy,
      uiLatencySensitivity: current.uiLatencySensitivity,
      silenceGapVariance:   this.calculateSilenceVariance(),
    }
  }

  private calculateSilenceVariance(): number {
    if (this.buffer.length < 2) return 0
    const intervals: number[] = []
    for (let i = 1; i < this.buffer.length; i++) {
      intervals.push(this.buffer[i].timestamp - this.buffer[i - 1].timestamp)
    }
    const mean        = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const squaredDiffs = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0)
    return squaredDiffs / intervals.length
  }

  public get currentFilledSize(): number { return this.buffer.length }
  public clear(): void { this.buffer = [] }
}

// ============================================================================
// 4. GENERATOR STRATEGIES
// ============================================================================

class AnchoredScriptureGenerator implements GeneratorModel {
  readonly id                  = 'G_ANCHOR_LITERAL'
  readonly targetSemanticSpace = 'SPACE_DETERMINISTIC_SCRIPTURE'

  public execute(_signal: ControlSignal): Omit<IOTrace, 'reasonCode'> {
    return {
      renderMode:               'literal_only',
      activeTokens:             ['structural_grid', 'raw_text_scaffold'],
      passthroughChannelActive: true,
      timestamp:                Date.now(),
    }
  }
}

class ChaoticDriftGenerator implements GeneratorModel {
  readonly id                  = 'G_CHAOTIC_DRIFT'
  readonly targetSemanticSpace = 'SPACE_RANDOM_TEMPORAL_MARKER'

  public execute(_signal: ControlSignal): Omit<IOTrace, 'reasonCode'> {
    return {
      renderMode:               'non_interactive',
      activeTokens:             ['temporal_scale_only'],
      passthroughChannelActive: false,
      timestamp:                Date.now(),
    }
  }
}

// ============================================================================
// 5. CONTROL OPERATOR (V6.2.1 Fix #2 + Fix #3)
// ============================================================================

export class MaisuiJoyControlOperator {
  private config:           MaisuiOperatorConfig
  private slidingWindow:    TelemetrySlidingWindow
  private readonly generators: readonly GeneratorModel[]
  private lastSelectedMode: RenderMode = 'interactive'

  constructor(customConfig?: Partial<MaisuiOperatorConfig>) {
    this.config = { ...DEFAULT_PRODUCTION_CONFIG, ...customConfig }
    this.validateConfig(this.config)
    this.slidingWindow = new TelemetrySlidingWindow(this.config.slidingWindowSize)
    this.generators    = Object.freeze([
      new AnchoredScriptureGenerator(),
      new ChaoticDriftGenerator(),
    ])
  }

  public updateConfig(partial: Partial<MaisuiOperatorConfig>): void {
    const merged = { ...this.config, ...partial }
    this.validateConfig(merged)
    if (partial.slidingWindowSize && partial.slidingWindowSize !== this.config.slidingWindowSize) {
      this.slidingWindow = new TelemetrySlidingWindow(partial.slidingWindowSize)
    }
    this.config = merged
    console.log(JSON.stringify({
      level: 'info', service: 'maisuijoy-core', event: 'CONFIG_UPDATED',
      timestamp: Date.now(), newConfig: this.config,
    }))
  }

  public resolveActionFromRawTelemetry(
    rawInput: RawTelemetryInput,
    signalConfidence: number,
  ): IOTrace {
    const signal = this.slidingWindow.computeCurrentSignal(rawInput)
    return this.resolveAction(signal, signalConfidence)
  }

  public resolveAction(signal: ControlSignal, signalConfidence: number): IOTrace {
    let tracePayload: Omit<IOTrace, 'reasonCode'>
    let reasonCode = 'BASELINE_DEFAULT'

    if (
      signalConfidence < this.config.minConfidence ||
      signal.silenceGapVariance > this.config.maxDriftLimitMs
    ) {
      reasonCode   = signalConfidence < this.config.minConfidence
        ? 'LOW_SIGNAL_CONFIDENCE_MELTDOWN'
        : 'TEMPORAL_DRIFT_EXCESSIVE'
      tracePayload = this.executeFlatBehavior()
    } else if (
      signal.inputEntropy     > this.config.entropyThreshold &&
      signal.interactionRate  < this.config.interactionRateFloor
    ) {
      reasonCode   = 'HIGH_CHAOS_ENTROPY_COLLAPSE'
      tracePayload = this.generators[1].execute(signal)
    } else if (signal.uiLatencySensitivity > this.config.uiLatencyCeiling) {
      reasonCode   = 'LATENCY_SENSITIVE_STRUCTURAL_ISOLATION'
      tracePayload = {
        renderMode:               'structural_only',
        activeTokens:             ['spacing_skeleton', 'hierarchy_grid'],
        passthroughChannelActive: false,
        timestamp:                Date.now(),
      }
    } else {
      reasonCode   = 'BASELINE_OPERATION'
      tracePayload = this.generators[0].execute(signal)
    }

    if (tracePayload.renderMode !== this.lastSelectedMode) {
      console.warn(JSON.stringify({
        level: 'warn', service: 'maisuijoy-core', event: 'MODE_TRANSITION',
        timestamp: Date.now(), from: this.lastSelectedMode,
        to: tracePayload.renderMode, reason: reasonCode,
      }))
    }
    this.lastSelectedMode = tracePayload.renderMode

    console.log(JSON.stringify({
      level: 'info', service: 'maisuijoy-core', event: 'RESOLVE_ACTION',
      timestamp: Date.now(),
      metrics: {
        entropy:    signal.inputEntropy,
        rate:       signal.interactionRate,
        latency:    signal.uiLatencySensitivity,
        variance:   signal.silenceGapVariance,
        confidence: signalConfidence,
      },
      allocation: {
        mode:   tracePayload.renderMode,
        reason: reasonCode,
        tokens: tracePayload.activeTokens,
      },
      bufferState: {
        windowSize:   this.config.slidingWindowSize,
        bufferFilled: this.slidingWindow.currentFilledSize,
      },
    }))

    return { ...tracePayload, reasonCode }
  }

  private validateConfig(config: MaisuiOperatorConfig): void {
    const rules: Array<{ field: keyof MaisuiOperatorConfig; min: number; max: number }> = [
      { field: 'minConfidence',        min: 0,     max: 1         },
      { field: 'maxDriftLimitMs',      min: 1000,  max: 86400000  },
      { field: 'entropyThreshold',     min: 0,     max: 1         },
      { field: 'interactionRateFloor', min: 0,     max: 1         },
      { field: 'uiLatencyCeiling',     min: 0,     max: 1         },
      { field: 'slidingWindowSize',    min: 2,     max: 100       },
      { field: 'groqTimeoutMs',        min: 5000,  max: 120000    },
      { field: 'groqMaxRetries',       min: 1,     max: 10        },
    ]
    for (const rule of rules) {
      const v = config[rule.field]
      if (typeof v !== 'number' || v < rule.min || v > rule.max) {
        throw new Error(
          `[MaisuiJoy] Config violation: "${rule.field}" = ${v}. Required range: [${rule.min}, ${rule.max}].`
        )
      }
    }
  }

  private executeFlatBehavior(): Omit<IOTrace, 'reasonCode'> {
    return {
      renderMode:               'flat_failure',
      activeTokens:             ['raw_static_text_only'],
      passthroughChannelActive: true,
      timestamp:                Date.now(),
    }
  }

  public getBufferStats(): { size: number; filled: number } {
    return { size: this.config.slidingWindowSize, filled: this.slidingWindow.currentFilledSize }
  }

  public clearBuffer(): void {
    this.slidingWindow.clear()
    console.log('[MaisuiJoy Core] Telemetry history buffer purged.')
  }
}

// ============================================================================
// 6. SHANNON ENTROPY UTILITY
// ============================================================================

export function calculateSignalEntropy(input: string): number {
  if (!input) return 0
  const freq: Record<string, number> = {}
  for (const char of input) freq[char] = (freq[char] ?? 0) + 1
  const len = input.length
  let entropy = 0
  for (const key in freq) {
    const p = freq[key] / len
    entropy -= p * Math.log2(p)
  }
  const normalized = entropy / 8
  return normalized > 1 ? 1 : normalized
}
