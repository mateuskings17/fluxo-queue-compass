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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      calls: {
        Row: {
          call_phrase: string
          code: string
          created_at: string
          id: string
          priority: boolean
          sector_id: string | null
          sector_name: string
          station_name: string
          step_id: string | null
          ticket_id: string
        }
        Insert: {
          call_phrase?: string
          code: string
          created_at?: string
          id?: string
          priority?: boolean
          sector_id?: string | null
          sector_name?: string
          station_name?: string
          step_id?: string | null
          ticket_id: string
        }
        Update: {
          call_phrase?: string
          code?: string
          created_at?: string
          id?: string
          priority?: boolean
          sector_id?: string | null
          sector_name?: string
          station_name?: string
          step_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "ticket_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sector_ids: string[]
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sector_ids?: string[]
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sector_ids?: string[]
          sort_order?: number
        }
        Relationships: []
      }
      sectors: {
        Row: {
          active: boolean
          auto_next_sector_id: string | null
          call_mode: string
          call_phrase: string
          created_at: string
          id: string
          kind: string
          name: string
          priority_ratio: number
          sort_order: number
          station_label: string
        }
        Insert: {
          active?: boolean
          auto_next_sector_id?: string | null
          call_mode?: string
          call_phrase?: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          priority_ratio?: number
          sort_order?: number
          station_label?: string
        }
        Update: {
          active?: boolean
          auto_next_sector_id?: string | null
          call_mode?: string
          call_phrase?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          priority_ratio?: number
          sort_order?: number
          station_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_auto_next_sector_id_fkey"
            columns: ["auto_next_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          chime_enabled: boolean
          id: number
          logo_url: string | null
          panel_history_count: number
          panel_message: string
          panel_title: string
          timezone: string
          totem_message: string
          totem_title: string
          unit_name: string
          updated_at: string
          voice_enabled: boolean
          voice_rate: number
          voice_repeat: number
          voice_template: string
          voice_volume: number
        }
        Insert: {
          chime_enabled?: boolean
          id?: number
          logo_url?: string | null
          panel_history_count?: number
          panel_message?: string
          panel_title?: string
          timezone?: string
          totem_message?: string
          totem_title?: string
          unit_name?: string
          updated_at?: string
          voice_enabled?: boolean
          voice_rate?: number
          voice_repeat?: number
          voice_template?: string
          voice_volume?: number
        }
        Update: {
          chime_enabled?: boolean
          id?: number
          logo_url?: string | null
          panel_history_count?: number
          panel_message?: string
          panel_title?: string
          timezone?: string
          totem_message?: string
          totem_title?: string
          unit_name?: string
          updated_at?: string
          voice_enabled?: boolean
          voice_rate?: number
          voice_repeat?: number
          voice_template?: string
          voice_volume?: number
        }
        Relationships: []
      }
      stations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sector_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sector_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sector_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "stations_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          attendant_name: string | null
          created_at: string
          description: string
          event: string
          id: string
          sector_name: string | null
          station_name: string | null
          ticket_id: string
        }
        Insert: {
          attendant_name?: string | null
          created_at?: string
          description?: string
          event: string
          id?: string
          sector_name?: string | null
          station_name?: string | null
          ticket_id: string
        }
        Update: {
          attendant_name?: string | null
          created_at?: string
          description?: string
          event?: string
          id?: string
          sector_name?: string | null
          station_name?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_steps: {
        Row: {
          attendant_name: string | null
          call_count: number
          called_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          queued_at: string | null
          sector_id: string | null
          sector_name: string
          seq: number
          started_at: string | null
          station_id: string | null
          station_name: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          attendant_name?: string | null
          call_count?: number
          called_at?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          queued_at?: string | null
          sector_id?: string | null
          sector_name?: string
          seq?: number
          started_at?: string | null
          station_id?: string | null
          station_name?: string | null
          status?: string
          ticket_id: string
        }
        Update: {
          attendant_name?: string | null
          call_count?: number
          called_at?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          queued_at?: string | null
          sector_id?: string | null
          sector_name?: string
          seq?: number
          started_at?: string | null
          station_id?: string | null
          station_name?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_steps_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_steps_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_steps_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          active: boolean
          created_at: string
          current_number: number
          description: string
          digits: number
          id: string
          last_reset_date: string | null
          name: string
          prefix: string
          priority: boolean
          reset_daily: boolean
          sort_order: number
          start_number: number
          target_sector_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_number?: number
          description?: string
          digits?: number
          id?: string
          last_reset_date?: string | null
          name: string
          prefix?: string
          priority?: boolean
          reset_daily?: boolean
          sort_order?: number
          start_number?: number
          target_sector_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          current_number?: number
          description?: string
          digits?: number
          id?: string
          last_reset_date?: string | null
          name?: string
          prefix?: string
          priority?: boolean
          reset_daily?: boolean
          sort_order?: number
          start_number?: number
          target_sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_target_sector_id_fkey"
            columns: ["target_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          number: number
          patient_name: string | null
          priority: boolean
          status: string
          ticket_type_id: string | null
          type_name: string
        }
        Insert: {
          code: string
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          id?: string
          number: number
          patient_name?: string | null
          priority?: boolean
          status?: string
          ticket_type_id?: string | null
          type_name?: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          id?: string
          number?: number
          patient_name?: string | null
          priority?: boolean
          status?: string
          ticket_type_id?: string | null
          type_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_next: {
        Args: {
          p_attendant?: string
          p_sector_id: string
          p_station_id: string
          p_type_ids?: string[]
        }
        Returns: {
          attendant_name: string | null
          call_count: number
          called_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          queued_at: string | null
          sector_id: string | null
          sector_name: string
          seq: number
          started_at: string | null
          station_id: string | null
          station_name: string | null
          status: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      call_step: {
        Args: { p_attendant?: string; p_station_id: string; p_step_id: string }
        Returns: {
          attendant_name: string | null
          call_count: number
          called_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          queued_at: string | null
          sector_id: string | null
          sector_name: string
          seq: number
          started_at: string | null
          station_id: string | null
          station_name: string | null
          status: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_ticket: {
        Args: { p_reason?: string; p_ticket_id: string }
        Returns: {
          code: string
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          number: number
          patient_name: string | null
          priority: boolean
          status: string
          ticket_type_id: string | null
          type_name: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_open_tickets: { Args: never; Returns: number }
      finish_step: {
        Args: {
          p_attendant?: string
          p_forward_sector_ids?: string[]
          p_step_id: string
        }
        Returns: {
          code: string
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          number: number
          patient_name: string | null
          priority: boolean
          status: string
          ticket_type_id: string | null
          type_name: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      issue_ticket: {
        Args: { p_patient_name?: string; p_type_id: string }
        Returns: {
          code: string
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          id: string
          number: number
          patient_name: string | null
          priority: boolean
          status: string
          ticket_type_id: string | null
          type_name: string
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_ticket_event: {
        Args: {
          p_attendant: string
          p_desc: string
          p_event: string
          p_sector: string
          p_station: string
          p_ticket: string
        }
        Returns: undefined
      }
      mark_no_show: {
        Args: { p_attendant?: string; p_step_id: string }
        Returns: {
          attendant_name: string | null
          call_count: number
          called_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          queued_at: string | null
          sector_id: string | null
          sector_name: string
          seq: number
          started_at: string | null
          station_id: string | null
          station_name: string | null
          status: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      requeue_step: {
        Args: { p_step_id: string }
        Returns: {
          attendant_name: string | null
          call_count: number
          called_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          queued_at: string | null
          sector_id: string | null
          sector_name: string
          seq: number
          started_at: string | null
          station_id: string | null
          station_name: string | null
          status: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_step: {
        Args: { p_attendant?: string; p_step_id: string }
        Returns: {
          attendant_name: string | null
          call_count: number
          called_at: string | null
          created_at: string
          finished_at: string | null
          id: string
          queued_at: string | null
          sector_id: string | null
          sector_name: string
          seq: number
          started_at: string | null
          station_id: string | null
          station_name: string | null
          status: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
