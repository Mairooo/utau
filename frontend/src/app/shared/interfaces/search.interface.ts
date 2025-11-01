export interface SearchResult {
  id: string;
  title: string;
  searchable_content: string;
  description: string;
  tempo: number;
  key_signature: string;
  duration: number;
  creator: string;
  creator_id: string | null;
  voicebank_name: string;
  voicebank_id: string | null;
  plays: number;
  likes: number;
  status: string;
  collection: string;
  cover_image?: string | null;
  _formatted?: {
    title: string;
    searchable_content: string;
    description: string;
  };
}

export interface SearchResponse {
  hits: SearchResult[];
  query: string;
  totalHits: number;
  processingTimeMs: number;
  facetDistribution?: any;
  pagination: {
    offset: number;
    limit: number;
    hasNext: boolean;
  };
}

export interface SearchSuggestion {
  id: string;
  title: string;
  creator: string;
  voicebank: string;
  highlighted: string;
}

export interface SearchSuggestionsResponse {
  suggestions: SearchSuggestion[];
}

export interface SearchParams {
  q?: string;
  limit?: number;
  offset?: number;
  voicebank?: string;
  creator?: string;
  sort?: string;
}
