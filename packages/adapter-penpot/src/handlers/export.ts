// ─── Penpot export_shape Handler ────────────────────────────────
//
// Penpot API notes:
// - shape.export({ type, scale }) → Promise<Uint8Array>
// - Supported types: 'png' | 'jpeg' | 'svg' | 'pdf'
// - Convert Uint8Array to base64 for WebSocket transport.

declare function btoa(data: string): string;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  export_shape: async (params: any) => {
    const { shapeId, format = "png", scale = 1 } = params;

    const shape = penpot.currentPage?.getShapeById(shapeId);
    if (!shape) {
      throw new Error(`Shape not found: ${shapeId}`);
    }

    const data = await shape.export({ type: format, scale });
    const base64 = uint8ArrayToBase64(data);

    return { shapeId, format, scale, data: base64 };
  },
};
