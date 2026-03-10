// ─── Penpot group_nodes / ungroup_nodes Handlers ─────────────────
//
// Penpot API notes:
// - `penpot.group(shapes)` groups an array of shapes, returns the new Group.
// - `penpot.ungroup(group)` ungroups a group shape, returns the child shapes.
// - `penpot.currentPage.findShapes()` can find shapes matching a predicate.

async function groupNodes(params: any): Promise<any> {
  const { shapeIds } = params;
  if (!Array.isArray(shapeIds) || shapeIds.length === 0) {
    throw new Error("group_nodes requires a non-empty shapeIds array");
  }

  const page = penpot.currentPage;
  if (!page) throw new Error("No current page");

  const shapes = (shapeIds as string[])
    .map((id: string) => page.getShapeById(id))
    .filter((s): s is NonNullable<typeof s> => s != null);
  if (shapes.length === 0) {
    throw new Error("No shapes found for the provided IDs");
  }

  const group = penpot.group(shapes);
  if (!group) throw new Error("Failed to create group");

  return { id: group.id, name: group.name };
}

async function ungroupNodes(params: any): Promise<any> {
  const { groupId } = params;
  if (!groupId) throw new Error("ungroup_nodes requires a groupId");

  const page = penpot.currentPage;
  if (!page) throw new Error("No current page");

  const group = page.getShapeById(groupId);
  if (!group) throw new Error(`Shape not found: ${groupId}`);
  if (group.type !== "group") throw new Error(`Shape ${groupId} is not a group (type: ${group.type})`);

  const children = "children" in group ? (group as any).children as any[] : [];
  const childIds = children.map((c: any) => c.id);

  penpot.ungroup(group as any);

  return { ungroupedIds: childIds };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  group_nodes: groupNodes,
  ungroup_nodes: ungroupNodes,
};
