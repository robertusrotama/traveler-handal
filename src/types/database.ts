// Format `supabase gen types typescript` untuk supabase/migrations/*. Ditulis tangan (CLI belum
// tersedia di container) — regenerate dengan `supabase gen types typescript --local` bila ada.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          day_id: string | null
          duration_min: number | null
          edited_by_user: boolean
          id: string
          notes: string | null
          place_id: string | null
          position: number
          search_query: string | null
          source: Database["public"]["Enums"]["activity_source"]
          start_time: string | null
          title: string
          trip_id: string
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          why: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          day_id?: string | null
          duration_min?: number | null
          edited_by_user?: boolean
          id?: string
          notes?: string | null
          place_id?: string | null
          position: number
          search_query?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          start_time?: string | null
          title: string
          trip_id: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          why?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          day_id?: string | null
          duration_min?: number | null
          edited_by_user?: boolean
          id?: string
          notes?: string | null
          place_id?: string | null
          position?: number
          search_query?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          start_time?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_trip_id_day_id_fkey"
            columns: ["trip_id", "day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["trip_id", "id"]
          },
          {
            foreignKeyName: "activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          input_tokens: number | null
          kind: Database["public"]["Enums"]["ai_kind"]
          model: string | null
          output_tokens: number | null
          provider: string
          requested_by: string | null
          status: Database["public"]["Enums"]["ai_status"]
          target_day_id: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_tokens?: number | null
          kind: Database["public"]["Enums"]["ai_kind"]
          model?: string | null
          output_tokens?: number | null
          provider: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["ai_status"]
          target_day_id?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_tokens?: number | null
          kind?: Database["public"]["Enums"]["ai_kind"]
          model?: string | null
          output_tokens?: number | null
          provider?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["ai_status"]
          target_day_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_target_day_id_fkey"
            columns: ["target_day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      days: {
        Row: {
          city: string | null
          date: string
          day_index: number
          id: string
          notes: string | null
          title: string | null
          trip_id: string
        }
        Insert: {
          city?: string | null
          date: string
          day_index: number
          id?: string
          notes?: string | null
          title?: string | null
          trip_id: string
        }
        Update: {
          city?: string | null
          date?: string
          day_index?: number
          id?: string
          notes?: string | null
          title?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          country_code: string
          fetched_at: string
          place_id: string | null
          query_normalized: string
        }
        Insert: {
          country_code: string
          fetched_at?: string
          place_id?: string | null
          query_normalized: string
        }
        Update: {
          country_code?: string
          fetched_at?: string
          place_id?: string | null
          query_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "geocode_cache_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      member_claims: {
        Row: {
          claimant_user_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          member_id: string
          status: Database["public"]["Enums"]["claim_status"]
          trip_id: string
        }
        Insert: {
          claimant_user_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          member_id: string
          status?: Database["public"]["Enums"]["claim_status"]
          trip_id: string
        }
        Update: {
          claimant_user_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          member_id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_claims_claimant_user_id_fkey"
            columns: ["claimant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_claims_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_claims_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_claims_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string | null
          fetched_at: string
          id: string
          lat: number
          lng: number
          name: string
          opening_hours: string | null
          provider: Database["public"]["Enums"]["place_provider"]
          provider_place_id: string
          raw: Json
        }
        Insert: {
          address?: string | null
          category?: string | null
          fetched_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          opening_hours?: string | null
          provider: Database["public"]["Enums"]["place_provider"]
          provider_place_id: string
          raw?: Json
        }
        Update: {
          address?: string | null
          category?: string | null
          fetched_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          opening_hours?: string | null
          provider?: Database["public"]["Enums"]["place_provider"]
          provider_place_id?: string
          raw?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_anonymous: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_anonymous?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_anonymous?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          key: string
          last_request_at: string
        }
        Insert: {
          key: string
          last_request_at: string
        }
        Update: {
          key?: string
          last_request_at?: string
        }
        Relationships: []
      }
      trip_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          can_use_ai: boolean
          display_name: string
          id: string
          joined_at: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          can_use_ai?: boolean
          display_name: string
          id?: string
          joined_at?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          can_use_ai?: boolean
          display_name?: string
          id?: string
          joined_at?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget_level: Database["public"]["Enums"]["budget_level"]
          cities: string[]
          country_code: string
          created_at: string
          end_date: string
          id: string
          interests: string[]
          interests_note: string | null
          owner_id: string
          pace: Database["public"]["Enums"]["trip_pace"]
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          title: string
          travelers_count: number
          updated_at: string
        }
        Insert: {
          budget_level?: Database["public"]["Enums"]["budget_level"]
          cities: string[]
          country_code: string
          created_at?: string
          end_date: string
          id?: string
          interests?: string[]
          interests_note?: string | null
          owner_id: string
          pace?: Database["public"]["Enums"]["trip_pace"]
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          title: string
          travelers_count: number
          updated_at?: string
        }
        Update: {
          budget_level?: Database["public"]["Enums"]["budget_level"]
          cities?: string[]
          country_code?: string
          created_at?: string
          end_date?: string
          id?: string
          interests?: string[]
          interests_note?: string | null
          owner_id?: string
          pace?: Database["public"]["Enums"]["trip_pace"]
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          title?: string
          travelers_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_trip: {
        Args: {
          p_budget_level?: Database["public"]["Enums"]["budget_level"]
          p_cities: string[]
          p_country_code: string
          p_end_date: string
          p_interests: string[]
          p_interests_note?: string
          p_pace?: Database["public"]["Enums"]["trip_pace"]
          p_start_date: string
          p_title: string
          p_travelers_count: number
        }
        Returns: string
      }
      decide_member_claim: {
        Args: { p_approve: boolean; p_claim_id: string }
        Returns: undefined
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          end_date: string
          owner_name: string
          start_date: string
          title: string
          trip_id: string
        }[]
      }
      is_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
      is_trip_owner: { Args: { p_trip_id: string }; Returns: boolean }
      join_trip: {
        Args: { p_display_name: string; p_token: string }
        Returns: string
      }
      list_claimable_members: {
        Args: { p_token: string }
        Returns: {
          display_name: string
          member_id: string
        }[]
      }
      my_claim_status: {
        Args: { p_claim_id: string }
        Returns: Database["public"]["Enums"]["claim_status"]
      }
      rebalance_positions: {
        Args: { p_day_id?: string; p_trip_id: string }
        Returns: undefined
      }
      request_member_claim: {
        Args: { p_member_id: string; p_token: string }
        Returns: string
      }
      rotate_trip_invite: {
        Args: { p_token_hash: string; p_trip_id: string }
        Returns: string
      }
      take_rate_limit_slot: {
        Args: { p_interval_ms: number; p_key: string }
        Returns: number
      }
      update_trip_dates: {
        Args: { p_end_date: string; p_start_date: string; p_trip_id: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_source: "ai" | "manual" | "import"
      ai_kind: "outline" | "day" | "ideas" | "alternatives" | "import"
      ai_status: "pending" | "success" | "failed"
      budget_level: "hemat" | "sedang" | "mewah"
      claim_status: "pending" | "approved" | "rejected"
      member_role: "owner" | "member"
      place_provider: "osm" | "google"
      trip_pace: "santai" | "sedang" | "padat"
      trip_status: "active" | "archived"
      verification_status: "verified" | "unverified" | "manual" | "none"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_source: ["ai", "manual", "import"],
      ai_kind: ["outline", "day", "ideas", "alternatives", "import"],
      ai_status: ["pending", "success", "failed"],
      budget_level: ["hemat", "sedang", "mewah"],
      claim_status: ["pending", "approved", "rejected"],
      member_role: ["owner", "member"],
      place_provider: ["osm", "google"],
      trip_pace: ["santai", "sedang", "padat"],
      trip_status: ["active", "archived"],
      verification_status: ["verified", "unverified", "manual", "none"],
    },
  },
} as const
