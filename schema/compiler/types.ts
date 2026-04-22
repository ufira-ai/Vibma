/** Raw YAML types — what the parser reads */

export interface RawParam {
  type?: string;
  $ref?: string;
  description?: string;
  optional?: boolean;
  required?: boolean;
  coerce?: string | boolean;
  default?: unknown;
  items?: RawParam | { type: string };
  properties?: Record<string, RawParam>;
  values?: string[];
  min?: number;
  max?: number;
  const?: string;
  /** Override the auto-generated TS type string in descriptions */
  tsType?: string;
  /** Accept alternate param names — preprocessed to canonical name before validation */
  aliases?: string[];
}

export interface RawResponse {
  type: string;
  description?: string;
  properties?: Record<string, RawParam>;
  required?: string[];
  example?: unknown;
  item?: Record<string, RawParam> | RawParam;
  /** Name the response interface for auto-generation in descriptions */
  tsType?: string;
}

export interface RawMethodDef {
  command?: string;
  tier: "read" | "create" | "edit";
  inline?: boolean;
  timeout?: number;
  description: string;
  /** Short example call for help output */
  example?: string;
  params: Record<string, RawParam> | {};
  response: RawResponse;
  /** For create methods with type discriminant */
  discriminant?: string;
  types?: Record<string, { description?: string; example?: string; params: Record<string, RawParam> }>;
}

export interface RawEndpointDef {
  endpoint: string;
  extends?: string;
  domain: string;
  description: string;
  description_zh?: string;
  notes?: string;
  methods: Record<string, RawMethodDef>;
}

export interface RawBaseDef {
  base: string;
  notes?: string;
  methods: Record<string, RawMethodDef>;
}

export type RawDef = RawEndpointDef | RawBaseDef;

export function isBaseDef(d: RawDef): d is RawBaseDef {
  return "base" in d;
}

export function isEndpointDef(d: RawDef): d is RawEndpointDef {
  return "endpoint" in d;
}

/** Resolved types — after $ref resolution and base merging */

export interface ResolvedMethod {
  name: string;
  command?: string;
  tier: "read" | "create" | "edit";
  inline?: boolean;
  timeout?: number;
  description: string;
  example?: string;
  params: Record<string, RawParam>;
  response: RawResponse;
  discriminant?: string;
  types?: Record<string, { description?: string; example?: string; params: Record<string, RawParam> }>;
  inherited?: boolean;
}

export interface ResolvedEndpoint {
  name: string;
  domain: string;
  description: string;
  descriptionZh?: string;
  notes?: string;
  methods: ResolvedMethod[];
}
