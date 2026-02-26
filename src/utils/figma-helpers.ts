// ─── Figma-side helper utilities ──────────────────────────────────
// These only run inside the Figma plugin sandbox.
// The `figma` global is provided by the Figma runtime.

/** Promise-based delay */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a simple command ID */
export function generateCommandId(): string {
  return (
    "cmd_" +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/** Send a progress update to the plugin UI */
export function sendProgressUpdate(
  commandId: string,
  commandType: string,
  status: "started" | "in_progress" | "completed" | "error",
  progress: number,
  totalItems: number,
  processedItems: number,
  message: string,
  payload: any = null
) {
  const update: any = {
    type: "command_progress",
    commandId,
    commandType,
    status,
    progress,
    totalItems,
    processedItems,
    message,
    timestamp: Date.now(),
  };

  if (payload) {
    if (payload.currentChunk !== undefined && payload.totalChunks !== undefined) {
      update.currentChunk = payload.currentChunk;
      update.totalChunks = payload.totalChunks;
      update.chunkSize = payload.chunkSize;
    }
    update.payload = payload;
  }

  figma.ui.postMessage(update);
  return update;
}

/** Build a SOLID paint from an RGBA color object (0-1 per channel) */
export function solidPaint(color: { r: number; g: number; b: number; a?: number }) {
  return {
    type: "SOLID" as const,
    color: {
      r: color.r ?? 0,
      g: color.g ?? 0,
      b: color.b ?? 0,
    },
    opacity: color.a ?? 1,
  };
}

/** Resolve a node by ID, throw if not found */
export async function getNode(nodeId: string): Promise<BaseNode> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return node;
}

/** Resolve a node by ID and verify it supports children */
export async function getParentNode(parentId: string): Promise<BaseNode & ChildrenMixin> {
  const node = await getNode(parentId);
  if (!("appendChild" in node)) {
    throw new Error(`Node does not support children: ${parentId}`);
  }
  return node as BaseNode & ChildrenMixin;
}

/** Append a node to a parent (by ID) or to the current page */
export async function appendToParentOrPage(
  node: SceneNode,
  parentId?: string
): Promise<void> {
  if (parentId) {
    const parent = await getParentNode(parentId);
    parent.appendChild(node);
  } else {
    figma.currentPage.appendChild(node);
  }
}

/** Apply deferred FILL sizing after a node has been appended to a parent */
export function applyDeferredFill(
  node: SceneNode & { layoutSizingHorizontal?: string; layoutSizingVertical?: string },
  deferH: boolean,
  deferV: boolean
) {
  if (deferH) {
    try { (node as any).layoutSizingHorizontal = "FILL"; } catch (_) {}
  }
  if (deferV) {
    try { (node as any).layoutSizingVertical = "FILL"; } catch (_) {}
  }
}

// ─── Text helpers ────────────────────────────────────────────────

function uniqBy<T>(arr: T[], predicate: string | ((item: T) => any)): T[] {
  const cb = typeof predicate === "function" ? predicate : (o: any) => o[predicate];
  return [
    ...arr
      .reduce((map, item) => {
        const key = item === null || item === undefined ? item : cb(item);
        map.has(key) || map.set(key, item);
        return map;
      }, new Map())
      .values(),
  ];
}

/** Set characters on a text node, handling mixed fonts gracefully */
export const setCharacters = async (
  node: TextNode,
  characters: string,
  options?: { fallbackFont?: FontName; smartStrategy?: string }
) => {
  const fallbackFont = options?.fallbackFont || { family: "Inter", style: "Regular" };
  try {
    if (node.fontName === figma.mixed) {
      if (options?.smartStrategy === "prevail") {
        const fontHashTree: Record<string, number> = {};
        for (let i = 1; i < node.characters.length; i++) {
          const charFont = node.getRangeFontName(i - 1, i) as FontName;
          const key = `${charFont.family}::${charFont.style}`;
          fontHashTree[key] = (fontHashTree[key] || 0) + 1;
        }
        const prevailed = Object.entries(fontHashTree).sort((a, b) => b[1] - a[1])[0];
        const [family, style] = prevailed[0].split("::");
        const prevailedFont = { family, style };
        await figma.loadFontAsync(prevailedFont);
        node.fontName = prevailedFont;
      } else if (options?.smartStrategy === "strict") {
        return setCharactersStrict(node, characters, fallbackFont);
      } else if (options?.smartStrategy === "experimental") {
        return setCharactersSmart(node, characters, fallbackFont);
      } else {
        const firstCharFont = node.getRangeFontName(0, 1) as FontName;
        await figma.loadFontAsync(firstCharFont);
        node.fontName = firstCharFont;
      }
    } else {
      await figma.loadFontAsync(node.fontName as FontName);
    }
  } catch {
    await figma.loadFontAsync(fallbackFont);
    node.fontName = fallbackFont;
  }
  try {
    node.characters = characters;
    return true;
  } catch {
    return false;
  }
};

async function setCharactersStrict(node: TextNode, characters: string, fallbackFont: FontName) {
  const fontHashTree: Record<string, string> = {};
  for (let i = 1; i < node.characters.length; i++) {
    const startIdx = i - 1;
    const startCharFont = node.getRangeFontName(startIdx, i) as FontName;
    const startVal = `${startCharFont.family}::${startCharFont.style}`;
    while (i < node.characters.length) {
      i++;
      const charFont = node.getRangeFontName(i - 1, i) as FontName;
      if (startVal !== `${charFont.family}::${charFont.style}`) break;
    }
    fontHashTree[`${startIdx}_${i}`] = startVal;
  }
  await figma.loadFontAsync(fallbackFont);
  node.fontName = fallbackFont;
  node.characters = characters;
  await Promise.all(
    Object.keys(fontHashTree).map(async (range) => {
      const [start, end] = range.split("_");
      const [family, style] = fontHashTree[range].split("::");
      const matchedFont = { family, style };
      await figma.loadFontAsync(matchedFont);
      return node.setRangeFontName(Number(start), Number(end), matchedFont);
    })
  );
  return true;
}

function getDelimiterPos(str: string, delimiter: string, startIdx = 0, endIdx = str.length) {
  const indices: [number, number][] = [];
  let temp = startIdx;
  for (let i = startIdx; i < endIdx; i++) {
    if (str[i] === delimiter && i + startIdx !== endIdx && temp !== i + startIdx) {
      indices.push([temp, i + startIdx]);
      temp = i + startIdx + 1;
    }
  }
  if (temp !== endIdx) indices.push([temp, endIdx]);
  return indices;
}

function buildLinearOrder(node: TextNode) {
  const fontTree: Array<{ start: number; delimiter: string; family: string; style: string }> = [];
  const newLinesPos = getDelimiterPos(node.characters, "\n");
  newLinesPos.forEach(([nlStart, nlEnd]) => {
    const nlFont = node.getRangeFontName(nlStart, nlEnd);
    if (nlFont === figma.mixed) {
      const spacesPos = getDelimiterPos(node.characters, " ", nlStart, nlEnd);
      spacesPos.forEach(([spStart, spEnd]) => {
        const spFont = node.getRangeFontName(spStart, spEnd) as FontName;
        fontTree.push({ start: spStart, delimiter: " ", family: spFont.family, style: spFont.style });
      });
    } else {
      fontTree.push({ start: nlStart, delimiter: "\n", family: (nlFont as FontName).family, style: (nlFont as FontName).style });
    }
  });
  return fontTree
    .sort((a, b) => a.start - b.start)
    .map(({ family, style, delimiter }) => ({ family, style, delimiter }));
}

async function setCharactersSmart(node: TextNode, characters: string, fallbackFont: FontName) {
  const rangeTree = buildLinearOrder(node);
  const fontsToLoad = uniqBy(rangeTree, ({ family, style }) => `${family}::${style}`).map(
    ({ family, style }) => ({ family, style })
  );
  await Promise.all([...fontsToLoad, fallbackFont].map((f) => figma.loadFontAsync(f)));
  node.fontName = fallbackFont;
  node.characters = characters;

  let prevPos = 0;
  rangeTree.forEach(({ family, style, delimiter }) => {
    if (prevPos < node.characters.length) {
      const delimPos = node.characters.indexOf(delimiter, prevPos);
      const endPos = delimPos > prevPos ? delimPos : node.characters.length;
      node.setRangeFontName(prevPos, endPos, { family, style });
      prevPos = endPos + 1;
    }
  });
  return true;
}

/** Map numeric font weight to Inter font style name */
export function getFontStyle(weight: number): string {
  switch (weight) {
    case 100: return "Thin";
    case 200: return "Extra Light";
    case 300: return "Light";
    case 400: return "Regular";
    case 500: return "Medium";
    case 600: return "Semi Bold";
    case 700: return "Bold";
    case 800: return "Extra Bold";
    case 900: return "Black";
    default: return "Regular";
  }
}
