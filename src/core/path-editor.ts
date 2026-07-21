/**
 * @fileoverview SVG path parsing and manipulation for anchor-point editing.
 *
 * Takes an SVG path `d` string (as produced by OpenType.js → our engine) and
 * breaks it into individual commands so we can:
 *   1. Identify every coordinate (anchor point or control handle)
 *   2. Render draggable circles at each point
 *   3. Update coordinates on drag and rebuild the path string
 *
 * ── Coordinate types ──
 *   - **On-curve** points (`M`, `L`, and the last pair of `Q`/`C`) define the
 *     shape's outline. These are the "anchors" users grab to deform a letter.
 *   - **Off-curve** / control points (first pair of `Q`, first/second of `C`)
 *     influence the curve but don't lie on it.
 */

export interface PathCommand {
  /** Command letter: M, L, Q, C, Z */
  type: string
  /** Coordinate pairs for this command */
  coords: { x: number; y: number }[]
}

export interface AnchorPoint {
  /** Global index across all commands */
  index: number
  /** Which command this point belongs to */
  commandIndex: number
  /** Which coordinate pair inside the command */
  coordIndex: number
  /** Whether this is a control handle (off-curve) */
  isControl: boolean
  /** Position */
  x: number
  y: number
  /** Original command type */
  commandType: string
  /** Whether this point survived simplification */
  retained: boolean
}

/**
 * Parse an SVG path `d` string into structured commands.
 */
export function parsePath(pathData: string): PathCommand[] {
  const commands: PathCommand[] = []
  // Match command letter followed by numbers
  const tokenRegex = /([MLQCZ])\s*([\d.-]+(?:\s+[\d.-]+)*)/gi
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(pathData)) !== null) {
    const type = match[1].toUpperCase()
    const nums = match[2].trim().split(/\s+/).map(Number)
    const coords: { x: number; y: number }[] = []

    if (type === 'Z') {
      commands.push({ type, coords: [] })
    } else {
      for (let i = 0; i < nums.length; i += 2) {
        coords.push({ x: nums[i], y: nums[i + 1] })
      }
      commands.push({ type, coords })
    }
  }

  return commands
}

/**
 * Convert parsed commands back into an SVG path `d` string.
 */
export function stringifyPath(commands: PathCommand[]): string {
  return commands
    .map((cmd) => {
      if (cmd.type === 'Z') return 'Z'
      const pairs = cmd.coords.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' ')
      return `${cmd.type} ${pairs}`
    })
    .join(' ')
}

function fmt(n: number): string {
  return parseFloat(n.toFixed(2)).toString()
}

/**
 * Extract a flat list of all anchor points from parsed path commands.
 * Each point includes enough metadata to update it later.
 */
export function getAnchorPoints(commands: PathCommand[]): AnchorPoint[] {
  const points: AnchorPoint[] = []
  let globalIdx = 0

  commands.forEach((cmd, ci) => {
    if (cmd.type === 'Z') return

    cmd.coords.forEach((c, pi) => {
      // For Q: first pair is the control point, second is the end point
      // For C: first two pairs are control points, third is the end point
      let isControl = false
      if (cmd.type === 'Q' && pi === 0) isControl = true
      if (cmd.type === 'C' && pi < 2) isControl = true

      points.push({
        index: globalIdx++,
        commandIndex: ci,
        coordIndex: pi,
        isControl,
        x: c.x,
        y: c.y,
        commandType: cmd.type,
        retained: true,
      })
    })
  })

  return points
}

/**
 * Update the coordinates of a specific anchor point and return the
 * new path string.
 */
export function updateAnchorPoint(
  commands: PathCommand[],
  commandIndex: number,
  coordIndex: number,
  x: number,
  y: number,
): string {
  const cmd = commands[commandIndex]
  if (cmd && cmd.coords[coordIndex]) {
    cmd.coords[coordIndex].x = x
    cmd.coords[coordIndex].y = y
  }
  return stringifyPath(commands)
}

/**
 * Compute the squared distance between two points.
 */
function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/**
 * Simplify on-curve anchor points by removing those that are roughly
 * collinear with their neighbours. Keeps the start/end of each contour.
 *
 * @param points - Full list of anchor points (including controls).
 * @param angleThreshold - Maximum angle (in degrees) to consider a point
 *   collinear. Lower = fewer points. Default 12°.
 * @returns A subset with `retained = false` for discarded points.
 */
export function simplifyAnchors(
  points: AnchorPoint[],
  angleThreshold = 12,
): AnchorPoint[] {
  const onCurve = points.filter((p) => !p.isControl)
  if (onCurve.length <= 3) return points

  const thresholdRad = (angleThreshold * Math.PI) / 180

  // Mark each on-curve point as retained or not.
  // We always keep the first and last point of each contour (indicated by M commands).
  for (let i = 1; i < onCurve.length - 1; i++) {
    const prev = onCurve[i - 1]
    const curr = onCurve[i]
    const next = onCurve[i + 1]

    // Skip if prev or next is a MoveTo (contour boundary)
    if (prev.commandType === 'M' || next.commandType === 'M') continue

    // Vectors from curr to prev and curr to next
    const v1x = prev.x - curr.x
    const v1y = prev.y - curr.y
    const v2x = next.x - curr.x
    const v2y = next.y - curr.y

    const len1 = Math.sqrt(v1x * v1x + v1y * v1y)
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y)
    if (len1 < 1 || len2 < 1) continue

    // Dot product → cosine of angle
    const dot = v1x * v2x + v1y * v2y
    const cos = dot / (len1 * len2)
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)))

    // If the angle is close to 180° (π), the point is collinear → discard.
    // angleThreshold radians away from π means we keep sharper corners.
    if (Math.PI - angle < thresholdRad) {
      curr.retained = false
    }
  }

  // Filter controls: show them only if their neighbouring on-curve point is retained
  for (const pt of points) {
    if (!pt.isControl) continue
    // Find the on-curve end point this control belongs to
    // For Q: the control belongs to the same command; keep if the end point is retained
    // For C: both controls belong to the same command
    const cmdPoints = points.filter(
      (p) => p.commandIndex === pt.commandIndex && !p.isControl,
    )
    pt.retained = cmdPoints.some((cp) => cp.retained)
  }

  return points
}
