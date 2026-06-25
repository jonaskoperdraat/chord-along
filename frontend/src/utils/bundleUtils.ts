import type { Block, Line, Section } from '../types/transcriptionBundle'

/**
 * Navigates into a root Section's body[] tree by successive array indices and
 * returns the Line at the end of the path.
 *
 * path=[i]    → root.body[i]          (direct Line child of root)
 * path=[i, j] → root.body[i].body[j]  (Line inside a named Section)
 */
export function resolveLine(root: Section, path: number[]): Line {
  let blocks: Block[] = root.body
  for (let i = 0; i < path.length - 1; i++) {
    const block = blocks[path[i]] as Section | undefined
    if (!block) throw new RangeError(`path[${i}] = ${path[i]} is out of range`)
    blocks = block.body
  }
  const result = blocks[path[path.length - 1]] as Line | undefined
  if (!result) throw new RangeError(`path[${path.length - 1}] = ${path[path.length - 1]} is out of range`)
  return result
}
