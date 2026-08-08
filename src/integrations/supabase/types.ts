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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approval_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          kind: string
          mime_type: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          kind: string
          mime_type?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          document_id: string | null
          from_status: Database["public"]["Enums"]["approval_status"] | null
          has_internal_note: boolean
          id: string
          reason: string | null
          request_id: string
          requested_fields: string[]
          to_status: Database["public"]["Enums"]["approval_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          document_id?: string | null
          from_status?: Database["public"]["Enums"]["approval_status"] | null
          has_internal_note?: boolean
          id?: string
          reason?: string | null
          request_id: string
          requested_fields?: string[]
          to_status?: Database["public"]["Enums"]["approval_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          document_id?: string | null
          from_status?: Database["public"]["Enums"]["approval_status"] | null
          has_internal_note?: boolean
          id?: string
          reason?: string | null
          request_id?: string
          requested_fields?: string[]
          to_status?: Database["public"]["Enums"]["approval_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          applicant_response: string | null
          assigned_reviewer: string | null
          created_at: string
          decision_at: string | null
          decision_by: string | null
          decision_reason: string | null
          id: string
          internal_reason: string | null
          request_instructions: string | null
          requested_fields: string[]
          response_deadline: string | null
          resubmitted_at: string | null
          review_started_at: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          user_message: string | null
          user_type: string
        }
        Insert: {
          applicant_response?: string | null
          assigned_reviewer?: string | null
          created_at?: string
          decision_at?: string | null
          decision_by?: string | null
          decision_reason?: string | null
          id?: string
          internal_reason?: string | null
          request_instructions?: string | null
          requested_fields?: string[]
          response_deadline?: string | null
          resubmitted_at?: string | null
          review_started_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          user_message?: string | null
          user_type?: string
        }
        Update: {
          applicant_response?: string | null
          assigned_reviewer?: string | null
          created_at?: string
          decision_at?: string | null
          decision_by?: string | null
          decision_reason?: string | null
          id?: string
          internal_reason?: string | null
          request_instructions?: string | null
          requested_fields?: string[]
          response_deadline?: string | null
          resubmitted_at?: string | null
          review_started_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          user_message?: string | null
          user_type?: string
        }
        Relationships: []
      }
      approval_settings: {
        Row: {
          created_at: string
          default_rejection_message: string
          id: boolean
          mandatory_student_fields: string[]
          mandatory_tutor_fields: string[]
          max_pending_days: number
          reminder_after_hours: number
          require_email_verification: boolean
          require_mobile_verification: boolean
          required_tutor_documents: string[]
          student_approval_required: boolean
          tutor_approval_required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_rejection_message?: string
          id?: boolean
          mandatory_student_fields?: string[]
          mandatory_tutor_fields?: string[]
          max_pending_days?: number
          reminder_after_hours?: number
          require_email_verification?: boolean
          require_mobile_verification?: boolean
          required_tutor_documents?: string[]
          student_approval_required?: boolean
          tutor_approval_required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_rejection_message?: string
          id?: boolean
          mandatory_student_fields?: string[]
          mandatory_tutor_fields?: string[]
          max_pending_days?: number
          reminder_after_hours?: number
          require_email_verification?: boolean
          require_mobile_verification?: boolean
          required_tutor_documents?: string[]
          student_approval_required?: boolean
          tutor_approval_required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      assignment_attachments: {
        Row: {
          assignment_id: string
          created_at: string
          external_url: string | null
          file_name: string | null
          file_size: number | null
          id: string
          kind: string
          mime_type: string | null
          storage_path: string | null
          title: string | null
          uploaded_by: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          storage_path?: string | null
          title?: string | null
          uploaded_by: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          storage_path?: string | null
          title?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_history: {
        Row: {
          action: string
          actor_id: string
          actor_role: string | null
          assignment_id: string
          comment: string | null
          created_at: string
          file_version: number | null
          from_status: string | null
          id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_role?: string | null
          assignment_id: string
          comment?: string | null
          created_at?: string
          file_version?: number | null
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string | null
          assignment_id?: string
          comment?: string | null
          created_at?: string
          file_version?: number | null
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          content: string | null
          created_at: string
          external_url: string | null
          feedback: string | null
          grade: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_late: boolean
          marks: number | null
          storage_path: string | null
          student_id: string
          submitted_at: string
          updated_at: string
          version: number
        }
        Insert: {
          assignment_id: string
          content?: string | null
          created_at?: string
          external_url?: string | null
          feedback?: string | null
          grade?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          marks?: number | null
          storage_path?: string | null
          student_id: string
          submitted_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          assignment_id?: string
          content?: string | null
          created_at?: string
          external_url?: string | null
          feedback?: string | null
          grade?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_late?: boolean
          marks?: number | null
          storage_path?: string | null
          student_id?: string
          submitted_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_resubmission: boolean
          assigned_at: string | null
          cancelled_at: string | null
          class_id: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          grade_level: string | null
          group_id: string
          id: string
          instructions: string | null
          priority: string
          published_at: string | null
          status: Database["public"]["Enums"]["assignment_state"]
          student_id: string
          subject: string | null
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          allow_resubmission?: boolean
          assigned_at?: string | null
          cancelled_at?: string | null
          class_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          grade_level?: string | null
          group_id?: string
          id?: string
          instructions?: string | null
          priority?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["assignment_state"]
          student_id: string
          subject?: string | null
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          allow_resubmission?: boolean
          assigned_at?: string | null
          cancelled_at?: string | null
          class_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          grade_level?: string | null
          group_id?: string
          id?: string
          instructions?: string | null
          priority?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["assignment_state"]
          student_id?: string
          subject?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_global: boolean
          kind: Database["public"]["Enums"]["calendar_event_kind"]
          location: string | null
          meeting_url: string | null
          owner_id: string
          repeat_byweekday: number[]
          repeat_count: number | null
          repeat_freq: string
          repeat_interval: number
          repeat_until: string | null
          starts_at: string
          time_zone: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          is_global?: boolean
          kind?: Database["public"]["Enums"]["calendar_event_kind"]
          location?: string | null
          meeting_url?: string | null
          owner_id: string
          repeat_byweekday?: number[]
          repeat_count?: number | null
          repeat_freq?: string
          repeat_interval?: number
          repeat_until?: string | null
          starts_at: string
          time_zone?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_global?: boolean
          kind?: Database["public"]["Enums"]["calendar_event_kind"]
          location?: string | null
          meeting_url?: string | null
          owner_id?: string
          repeat_byweekday?: number[]
          repeat_count?: number | null
          repeat_freq?: string
          repeat_interval?: number
          repeat_until?: string | null
          starts_at?: string
          time_zone?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_preferences: {
        Row: {
          filters: Json
          hidden_calendars: string[]
          time_zone: string | null
          updated_at: string
          user_id: string
          view: string
        }
        Insert: {
          filters?: Json
          hidden_calendars?: string[]
          time_zone?: string | null
          updated_at?: string
          user_id: string
          view?: string
        }
        Update: {
          filters?: Json
          hidden_calendars?: string[]
          time_zone?: string | null
          updated_at?: string
          user_id?: string
          view?: string
        }
        Relationships: []
      }
      class_attendance: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_feedback: {
        Row: {
          author_id: string
          class_id: string
          created_at: string
          homework: string | null
          id: string
          note_to_parent: string | null
          topic_covered: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string
          class_id: string
          created_at?: string
          homework?: string | null
          id?: string
          note_to_parent?: string | null
          topic_covered?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          class_id?: string
          created_at?: string
          homework?: string | null
          id?: string
          note_to_parent?: string | null
          topic_covered?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_feedback_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_materials: {
        Row: {
          class_id: string
          created_at: string
          external_url: string | null
          id: string
          notes: string | null
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          class_id: string
          created_at?: string
          external_url?: string | null
          id?: string
          notes?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          external_url?: string | null
          id?: string
          notes?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_participants: {
        Row: {
          added_by: string
          class_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string
          class_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string
          class_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_participants_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          preferred_time: string | null
          status: Database["public"]["Enums"]["request_status"]
          student_id: string
          subject: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          preferred_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          student_id: string
          subject?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          preferred_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          student_id?: string
          subject?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_requests_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          created_by: string
          duration_minutes: number
          id: string
          is_demo: boolean
          meeting_url: string | null
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["class_status"]
          student_id: string
          subject: string | null
          time_zone: string
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          duration_minutes?: number
          id?: string
          is_demo?: boolean
          meeting_url?: string | null
          notes?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["class_status"]
          student_id: string
          subject?: string | null
          time_zone?: string
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          duration_minutes?: number
          id?: string
          is_demo?: boolean
          meeting_url?: string | null
          notes?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["class_status"]
          student_id?: string
          subject?: string | null
          time_zone?: string
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_access_log: {
        Row: {
          created_at: string
          document_id: string
          id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "approval_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_flags: {
        Row: {
          created_at: string
          id: string
          match_field: string
          match_value: string | null
          matched_user_id: string | null
          request_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          match_field: string
          match_value?: string | null
          matched_user_id?: string | null
          request_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          match_field?: string
          match_value?: string | null
          matched_user_id?: string | null
          request_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_flags_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      event_history: {
        Row: {
          action: string
          actor_id: string
          actor_role: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          previous_value: string | null
          source: string
          source_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_role?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          previous_value?: string | null
          source: string
          source_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          previous_value?: string | null
          source?: string
          source_id?: string
        }
        Relationships: []
      }
      event_reminders: {
        Row: {
          channel: string
          created_at: string
          id: string
          minutes_before: number
          sent_at: string | null
          source: string
          source_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          minutes_before?: number
          sent_at?: string | null
          source: string
          source_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          minutes_before?: number
          sent_at?: string | null
          source?: string
          source_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loop_requests: {
        Row: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          duration_minutes: number
          expires_at: string
          grade_level: string | null
          id: string
          notes: string | null
          preferred_start: string | null
          rating: number | null
          rating_comment: string | null
          start_mode: string
          status: Database["public"]["Enums"]["loop_status"]
          student_id: string
          subject: string
          topic: string | null
          tutor_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string
          duration_minutes?: number
          expires_at?: string
          grade_level?: string | null
          id?: string
          notes?: string | null
          preferred_start?: string | null
          rating?: number | null
          rating_comment?: string | null
          start_mode?: string
          status?: Database["public"]["Enums"]["loop_status"]
          student_id: string
          subject: string
          topic?: string | null
          tutor_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          class_id?: string | null
          created_at?: string
          duration_minutes?: number
          expires_at?: string
          grade_level?: string | null
          id?: string
          notes?: string | null
          preferred_start?: string | null
          rating?: number | null
          rating_comment?: string | null
          start_mode?: string
          status?: Database["public"]["Enums"]["loop_status"]
          student_id?: string
          subject?: string
          topic?: string | null
          tutor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loop_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          class_id: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          class_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string
        }
        Update: {
          body?: string
          class_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          class_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_name: string | null
          account_number: string | null
          ifsc: string | null
          method: string
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          ifsc?: string | null
          method?: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          ifsc?: string | null
          method?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          note: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
          tutor_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          tutor_id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          classes_included: number
          created_at: string
          currency: string
          description: string | null
          features: string[]
          id: string
          interval: Database["public"]["Enums"]["plan_interval"]
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          classes_included?: number
          created_at?: string
          currency?: string
          description?: string | null
          features?: string[]
          id?: string
          interval?: Database["public"]["Enums"]["plan_interval"]
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          classes_included?: number
          created_at?: string
          currency?: string
          description?: string | null
          features?: string[]
          id?: string
          interval?: Database["public"]["Enums"]["plan_interval"]
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profile_contacts: {
        Row: {
          contact_email: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          subjects: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id: string
          subjects?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          subjects?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          class_id: string
          created_at: string
          duration_label: string | null
          external_url: string | null
          id: string
          storage_path: string | null
          title: string
          uploaded_by: string
        }
        Insert: {
          class_id: string
          created_at?: string
          duration_label?: string | null
          external_url?: string | null
          id?: string
          storage_path?: string | null
          title: string
          uploaded_by?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          duration_label?: string | null
          external_url?: string | null
          id?: string
          storage_path?: string | null
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          note: string | null
          referral_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          referral_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          referral_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          created_at: string
          currency: string
          id: boolean
          is_active: boolean
          max_rewards_per_user: number
          milestone: string
          referee_reward: number
          referrer_reward: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: boolean
          is_active?: boolean
          max_rewards_per_user?: number
          milestone?: string
          referee_reward?: number
          referrer_reward?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: boolean
          is_active?: boolean
          max_rewards_per_user?: number
          milestone?: string
          referee_reward?: number
          referrer_reward?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          qualified_at: string | null
          referred_id: string
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_id: string
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_id?: string
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      registration_details: {
        Row: {
          availability_notes: string | null
          background_check_status: string
          certifications: string | null
          country: string | null
          created_at: string
          education: string | null
          grade: string | null
          grades_taught: string | null
          hourly_rate: number | null
          intro_video_url: string | null
          mobile: string | null
          mobile_verified: boolean
          notification_consent: boolean
          parent_contact: string | null
          parent_name: string | null
          referral_source: string | null
          school: string | null
          short_bio: string | null
          state: string | null
          subjects_of_interest: string | null
          subjects_taught: string | null
          teaching_experience: string | null
          terms_accepted_at: string | null
          time_zone: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
          work_experience: string | null
        }
        Insert: {
          availability_notes?: string | null
          background_check_status?: string
          certifications?: string | null
          country?: string | null
          created_at?: string
          education?: string | null
          grade?: string | null
          grades_taught?: string | null
          hourly_rate?: number | null
          intro_video_url?: string | null
          mobile?: string | null
          mobile_verified?: boolean
          notification_consent?: boolean
          parent_contact?: string | null
          parent_name?: string | null
          referral_source?: string | null
          school?: string | null
          short_bio?: string | null
          state?: string | null
          subjects_of_interest?: string | null
          subjects_taught?: string | null
          teaching_experience?: string | null
          terms_accepted_at?: string | null
          time_zone?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          work_experience?: string | null
        }
        Update: {
          availability_notes?: string | null
          background_check_status?: string
          certifications?: string | null
          country?: string | null
          created_at?: string
          education?: string | null
          grade?: string | null
          grades_taught?: string | null
          hourly_rate?: number | null
          intro_video_url?: string | null
          mobile?: string | null
          mobile_verified?: boolean
          notification_consent?: boolean
          parent_contact?: string | null
          parent_name?: string | null
          referral_source?: string | null
          school?: string | null
          short_bio?: string | null
          state?: string | null
          subjects_of_interest?: string | null
          subjects_taught?: string | null
          teaching_experience?: string | null
          terms_accepted_at?: string | null
          time_zone?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          work_experience?: string | null
        }
        Relationships: []
      }
      submission_files: {
        Row: {
          assignment_id: string
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          submission_id: string
          uploaded_by: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          submission_id: string
          uploaded_by: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          submission_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_files_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          time_zone: string
          tutor_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          time_zone?: string
          tutor_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          time_zone?: string
          tutor_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_details: {
        Row: {
          badge: string | null
          created_at: string
          currency: string
          degree: string | null
          headline: string | null
          hourly_rate: number
          languages: string | null
          updated_at: string
          user_id: string
          years_experience: number
        }
        Insert: {
          badge?: string | null
          created_at?: string
          currency?: string
          degree?: string | null
          headline?: string | null
          hourly_rate?: number
          languages?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number
        }
        Update: {
          badge?: string | null
          created_at?: string
          currency?: string
          degree?: string | null
          headline?: string | null
          hourly_rate?: number
          languages?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          student_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          student_id?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          student_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_ratings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      activate_pending_approval: {
        Args: never
        Returns: Database["public"]["Enums"]["approval_status"]
      }
      claim_loop_request: {
        Args: { _request_id: string }
        Returns: {
          accepted_at: string | null
          class_id: string | null
          created_at: string
          duration_minutes: number
          expires_at: string
          grade_level: string | null
          id: string
          notes: string | null
          preferred_start: string | null
          rating: number | null
          rating_comment: string | null
          start_mode: string
          status: Database["public"]["Enums"]["loop_status"]
          student_id: string
          subject: string
          topic: string | null
          tutor_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "loop_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      directory_roles: {
        Args: never
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      is_approval_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      my_approval_status: {
        Args: never
        Returns: Database["public"]["Enums"]["approval_status"]
      }
      notify_approval_admins: {
        Args: { _body: string; _title: string }
        Returns: undefined
      }
      public_tutor_previews: {
        Args: never
        Returns: {
          avatar_url: string
          badge: string
          bio: string
          currency: string
          full_name: string
          headline: string
          hourly_rate: number
          id: string
          languages: string
          rating_avg: number
          rating_count: number
          subjects: string
          years_experience: number
        }[]
      }
      resolve_referral_code: { Args: { _code: string }; Returns: string }
      tutor_reviews: {
        Args: { _tutor_id: string }
        Returns: {
          comment: string
          created_at: string
          rating: number
        }[]
      }
    }
    Enums: {
      app_role: "tutor" | "student" | "admin" | "super_admin"
      approval_status:
        | "draft"
        | "pending_approval"
        | "under_review"
        | "more_info_required"
        | "approved"
        | "rejected"
        | "suspended"
        | "deactivated"
      assignment_state:
        | "draft"
        | "assigned"
        | "viewed"
        | "in_progress"
        | "submitted"
        | "submitted_late"
        | "under_review"
        | "revision_requested"
        | "resubmitted"
        | "graded"
        | "completed"
        | "cancelled"
        | "overdue"
      assignment_status: "assigned" | "submitted" | "graded" | "returned"
      calendar_event_kind: "personal" | "blocked" | "holiday"
      class_status: "scheduled" | "completed" | "cancelled"
      loop_status: "open" | "matched" | "cancelled" | "expired" | "completed"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      payout_status: "requested" | "approved" | "paid" | "rejected"
      plan_interval: "one_time" | "monthly" | "yearly"
      request_status: "pending" | "accepted" | "declined"
      subscription_status: "active" | "cancelled" | "past_due"
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
      app_role: ["tutor", "student", "admin", "super_admin"],
      approval_status: [
        "draft",
        "pending_approval",
        "under_review",
        "more_info_required",
        "approved",
        "rejected",
        "suspended",
        "deactivated",
      ],
      assignment_state: [
        "draft",
        "assigned",
        "viewed",
        "in_progress",
        "submitted",
        "submitted_late",
        "under_review",
        "revision_requested",
        "resubmitted",
        "graded",
        "completed",
        "cancelled",
        "overdue",
      ],
      assignment_status: ["assigned", "submitted", "graded", "returned"],
      calendar_event_kind: ["personal", "blocked", "holiday"],
      class_status: ["scheduled", "completed", "cancelled"],
      loop_status: ["open", "matched", "cancelled", "expired", "completed"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      payout_status: ["requested", "approved", "paid", "rejected"],
      plan_interval: ["one_time", "monthly", "yearly"],
      request_status: ["pending", "accepted", "declined"],
      subscription_status: ["active", "cancelled", "past_due"],
    },
  },
} as const
