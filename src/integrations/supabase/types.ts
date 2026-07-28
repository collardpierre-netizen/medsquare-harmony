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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          booking_enabled: boolean
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          end_date: string | null
          external_registration_url: string | null
          id: string
          is_active: boolean
          is_free: boolean
          location: string | null
          max_participants: number | null
          photo_url: string | null
          photos: string[] | null
          practitioner_id: string
          price: number | null
          recurrence: Json | null
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          booking_enabled?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          end_date?: string | null
          external_registration_url?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          location?: string | null
          max_participants?: number | null
          photo_url?: string | null
          photos?: string[] | null
          practitioner_id: string
          price?: number | null
          recurrence?: Json | null
          start_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          booking_enabled?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          end_date?: string | null
          external_registration_url?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          location?: string | null
          max_participants?: number | null
          photo_url?: string | null
          photos?: string[] | null
          practitioner_id?: string
          price?: number | null
          recurrence?: Json | null
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_registrations: {
        Row: {
          cancellation_token: string
          created_at: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          session_id: string
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          cancellation_token?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          session_id: string
          source?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          cancellation_token?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          session_id?: string
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "activity_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_sessions: {
        Row: {
          activity_id: string
          created_at: string
          end_time: string
          id: string
          max_participants: number | null
          room_id: string | null
          start_time: string
          status: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          end_time: string
          id?: string
          max_participants?: number | null
          room_id?: string | null
          start_time: string
          status?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          end_time?: string
          id?: string
          max_participants?: number | null
          room_id?: string | null
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          activity_id: string | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          practitioner_id: string
          recurrence_group_id: string | null
          room_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          practitioner_id: string
          recurrence_group_id?: string | null
          room_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          practitioner_id?: string
          recurrence_group_id?: string | null
          room_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          file_url: string
          id: string
          name: string
          practitioner_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_url: string
          id?: string
          name: string
          practitioner_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_url?: string
          id?: string
          name?: string
          practitioner_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_acknowledgments: {
        Row: {
          acknowledged_at: string
          document_id: string
          id: string
          user_id: string
          version_acknowledged: number
        }
        Insert: {
          acknowledged_at?: string
          document_id: string
          id?: string
          user_id: string
          version_acknowledged: number
        }
        Update: {
          acknowledged_at?: string
          document_id?: string
          id?: string
          user_id?: string
          version_acknowledged?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_acknowledgments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          title: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          title: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          id: string
          metadata: Json | null
          practitioner_id: string
          sent_at: string
          status: string
          template_id: string
        }
        Insert: {
          channel?: string
          id?: string
          metadata?: Json | null
          practitioner_id: string
          sent_at?: string
          status?: string
          template_id: string
        }
        Update: {
          channel?: string
          id?: string
          metadata?: Json | null
          practitioner_id?: string
          sent_at?: string
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      practitioner_notifications: {
        Row: {
          body: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          expires_at: string | null
          id: string
          is_read: boolean
          practitioner_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          practitioner_id: string
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          practitioner_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_notifications_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_qna: {
        Row: {
          answer: string | null
          author_name: string | null
          category: string | null
          created_at: string
          id: string
          is_published: boolean
          practitioner_id: string
          question: string
        }
        Insert: {
          answer?: string | null
          author_name?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          practitioner_id: string
          question: string
        }
        Update: {
          answer?: string | null
          author_name?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          practitioner_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_qna_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_rates: {
        Row: {
          act_label: string
          consult_mode: string
          created_at: string
          duration_minutes: number | null
          effective_date: string
          id: string
          inami_total: number | null
          patient_bim: number | null
          patient_normal: number | null
          practitioner_id: string
        }
        Insert: {
          act_label: string
          consult_mode?: string
          created_at?: string
          duration_minutes?: number | null
          effective_date?: string
          id?: string
          inami_total?: number | null
          patient_bim?: number | null
          patient_normal?: number | null
          practitioner_id: string
        }
        Update: {
          act_label?: string
          consult_mode?: string
          created_at?: string
          duration_minutes?: number | null
          effective_date?: string
          id?: string
          inami_total?: number | null
          patient_bim?: number | null
          patient_normal?: number | null
          practitioner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_rates_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_reviews: {
        Row: {
          author_email: string | null
          author_name: string
          created_at: string
          id: string
          is_approved: boolean
          is_verified: boolean
          practitioner_id: string
          review_text: string | null
          score_explanation: number | null
          score_global: number
          score_listening: number | null
          score_premises: number | null
          score_punctuality: number | null
        }
        Insert: {
          author_email?: string | null
          author_name?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          practitioner_id: string
          review_text?: string | null
          score_explanation?: number | null
          score_global: number
          score_listening?: number | null
          score_premises?: number | null
          score_punctuality?: number | null
        }
        Update: {
          author_email?: string | null
          author_name?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          practitioner_id?: string
          review_text?: string | null
          score_explanation?: number | null
          score_global?: number
          score_listening?: number | null
          score_premises?: number | null
          score_punctuality?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_reviews_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_room_packages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          monthly_fee: number
          notes: string | null
          package_label: string
          practitioner_id: string
          room_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee: number
          notes?: string | null
          package_label: string
          practitioner_id: string
          room_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          notes?: string | null
          package_label?: string
          practitioner_id?: string
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_room_packages_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_room_packages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_new_patients: boolean
          associations: string[] | null
          avatar_url: string | null
          avg_appointment_delay_days: number | null
          bio: string | null
          break_minutes: number
          collaboration_ids: string[] | null
          contact_email: string | null
          conventioned: boolean | null
          created_at: string
          display_order: number
          experiences: Json | null
          external_booking_url: string | null
          first_name: string
          formations: Json | null
          home_visit: boolean
          id: string
          inami_number: string | null
          is_active: boolean
          languages: string[] | null
          last_name: string
          missing_fields: Json | null
          notification_preferences: Json
          parking: boolean
          payment_methods: string[] | null
          phone: string | null
          pmr_accessible: boolean
          profile_score: number | null
          schedule: Json | null
          social_links: Json | null
          specialties: string[] | null
          specialty: string | null
          tiers_payant: boolean
          updated_at: string
          user_id: string
          video_available: boolean
        }
        Insert: {
          accepts_new_patients?: boolean
          associations?: string[] | null
          avatar_url?: string | null
          avg_appointment_delay_days?: number | null
          bio?: string | null
          break_minutes?: number
          collaboration_ids?: string[] | null
          contact_email?: string | null
          conventioned?: boolean | null
          created_at?: string
          display_order?: number
          experiences?: Json | null
          external_booking_url?: string | null
          first_name?: string
          formations?: Json | null
          home_visit?: boolean
          id?: string
          inami_number?: string | null
          is_active?: boolean
          languages?: string[] | null
          last_name?: string
          missing_fields?: Json | null
          notification_preferences?: Json
          parking?: boolean
          payment_methods?: string[] | null
          phone?: string | null
          pmr_accessible?: boolean
          profile_score?: number | null
          schedule?: Json | null
          social_links?: Json | null
          specialties?: string[] | null
          specialty?: string | null
          tiers_payant?: boolean
          updated_at?: string
          user_id: string
          video_available?: boolean
        }
        Update: {
          accepts_new_patients?: boolean
          associations?: string[] | null
          avatar_url?: string | null
          avg_appointment_delay_days?: number | null
          bio?: string | null
          break_minutes?: number
          collaboration_ids?: string[] | null
          contact_email?: string | null
          conventioned?: boolean | null
          created_at?: string
          display_order?: number
          experiences?: Json | null
          external_booking_url?: string | null
          first_name?: string
          formations?: Json | null
          home_visit?: boolean
          id?: string
          inami_number?: string | null
          is_active?: boolean
          languages?: string[] | null
          last_name?: string
          missing_fields?: Json | null
          notification_preferences?: Json
          parking?: boolean
          payment_methods?: string[] | null
          phone?: string | null
          pmr_accessible?: boolean
          profile_score?: number | null
          schedule?: Json | null
          social_links?: Json | null
          specialties?: string[] | null
          specialty?: string | null
          tiers_payant?: boolean
          updated_at?: string
          user_id?: string
          video_available?: boolean
        }
        Relationships: []
      }
      rooms: {
        Row: {
          assigned_practitioner_id: string | null
          capacity: number | null
          created_at: string
          credits_info: string | null
          description: string | null
          equipment: string[] | null
          floor: string | null
          hourly_rate: number | null
          id: string
          is_available: boolean
          min_monthly_hours: number | null
          min_monthly_price: number | null
          name: string
          photos: string[] | null
          pricing: Json | null
          privatization_monthly_fee: number | null
          privatized_from: string | null
          privatized_until: string | null
          surface_area: number | null
          updated_at: string
        }
        Insert: {
          assigned_practitioner_id?: string | null
          capacity?: number | null
          created_at?: string
          credits_info?: string | null
          description?: string | null
          equipment?: string[] | null
          floor?: string | null
          hourly_rate?: number | null
          id?: string
          is_available?: boolean
          min_monthly_hours?: number | null
          min_monthly_price?: number | null
          name: string
          photos?: string[] | null
          pricing?: Json | null
          privatization_monthly_fee?: number | null
          privatized_from?: string | null
          privatized_until?: string | null
          surface_area?: number | null
          updated_at?: string
        }
        Update: {
          assigned_practitioner_id?: string | null
          capacity?: number | null
          created_at?: string
          credits_info?: string | null
          description?: string | null
          equipment?: string[] | null
          floor?: string | null
          hourly_rate?: number | null
          id?: string
          is_available?: boolean
          min_monthly_hours?: number | null
          min_monthly_price?: number | null
          name?: string
          photos?: string[] | null
          pricing?: Json | null
          privatization_monthly_fee?: number | null
          privatized_from?: string | null
          privatized_until?: string | null
          surface_area?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_assigned_practitioner_id_fkey"
            columns: ["assigned_practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_profile_score: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      count_session_registrations: {
        Args: { session_uuid: string }
        Returns: number
      }
      generate_recurring_sessions: { Args: never; Returns: undefined }
      get_auth_emails_for_users: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_practitioner_login_status: {
        Args: never
        Returns: {
          last_sign_in_at: string
          user_id: string
        }[]
      }
      get_review_author_emails: {
        Args: { review_ids: string[] }
        Returns: {
          author_email: string
          review_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "practitioner" | "patient"
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
      app_role: ["admin", "practitioner", "patient"],
    },
  },
} as const
