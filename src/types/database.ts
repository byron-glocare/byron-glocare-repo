/**
 * Glocare 교육생 관리 시스템 — Supabase 데이터베이스 타입
 *
 * 0001_init_schema.sql / 0002_seed_settings_and_status_options.sql 와 1:1 일치.
 * 스키마 변경 시 마이그레이션과 함께 이 파일도 업데이트 할 것.
 *
 * 향후 Supabase CLI 로 자동 생성하려면:
 *   1) https://supabase.com/dashboard/account/tokens 에서 Personal Access Token 발급
 *   2) `SUPABASE_ACCESS_TOKEN=xxx npx supabase gen types typescript \
 *        --project-id oczjvsxmlbuicyhheelc --schema public > src/types/database.ts`
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================================
// 도메인 enum/literal
// =============================================================================

export type Gender = "남" | "여";
export type DesiredTime = "주간" | "야간";
export type ProductType = "교육" | "웰컴팩" | "교육+웰컴팩";
export type TerminationReason = "요양보호사 직종변경" | "귀국" | "연락두절";
export type ClassType = "weekday" | "night";
export type ConsultationType = "training_center" | "care_home";
export type CommissionStatus = "pending" | "notified" | "completed";
export type ReservationRefundReason =
  | "중도탈락_매출인식"
  | "교육생환급_공제없음"
  | "소개비_공제"
  | "교육원섭외실패_환불";

// =============================================================================
// Supabase Database 인터페이스
// =============================================================================

export type Database = {
  public: {
    Tables: {
      // -----------------------------------------------------------------------
      status_options: {
        Row: {
          id: string;
          code: string;
          label: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["status_options"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      training_centers: {
        Row: {
          id: string;
          code: string;
          name: string;
          region: string | null;
          address: string | null;
          business_number: string | null;
          director_name: string | null;
          phone: string | null;
          email: string | null;
          bank_name: string | null;
          bank_account: string | null;
          tuition_fee_2025: number | null;
          tuition_fee_2026: number | null;
          class_hours: string | null;
          naeil_card_eligible: boolean;
          contract_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          region?: string | null;
          address?: string | null;
          business_number?: string | null;
          director_name?: string | null;
          phone?: string | null;
          email?: string | null;
          bank_name?: string | null;
          bank_account?: string | null;
          tuition_fee_2025?: number | null;
          tuition_fee_2026?: number | null;
          class_hours?: string | null;
          naeil_card_eligible?: boolean;
          contract_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_centers"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      training_classes: {
        Row: {
          id: string;
          training_center_id: string;
          year: number;
          month: number;
          class_type: ClassType;
          start_date: string | null;
          end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          training_center_id: string;
          year: number;
          month: number;
          class_type: ClassType;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_classes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "training_classes_training_center_id_fkey";
            columns: ["training_center_id"];
            referencedRelation: "training_centers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      care_homes: {
        Row: {
          id: string;
          code: string;
          name: string;
          region: string | null;
          address: string | null;
          director_name: string | null;
          phone: string | null;
          contact_person: string | null;
          contact_phone: string | null;
          bed_capacity: string | null;
          partnership_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          region?: string | null;
          address?: string | null;
          director_name?: string | null;
          phone?: string | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          bed_capacity?: string | null;
          partnership_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["care_homes"]["Insert"]>;
        Relationships: [];
      };

      // -----------------------------------------------------------------------
      customers: {
        Row: {
          id: string;
          code: string;
          legacy_status: string | null;
          name_vi: string | null;
          name_kr: string | null;
          address: string | null;
          gender: Gender | null;
          birth_year: number | null;
          phone: string | null;
          email: string | null;
          visa_type: string | null;
          topik_level: string | null;
          stay_remaining: string | null;
          desired_period: string | null;
          desired_time: DesiredTime | null;
          desired_region: string | null;
          training_center_id: string | null;
          training_class_id: string | null;
          care_home_id: string | null;
          class_start_date: string | null;
          class_end_date: string | null;
          work_start_date: string | null;
          work_end_date: string | null;
          visa_change_date: string | null;
          interview_date: string | null;
          product_type: ProductType | null;
          is_waiting: boolean;
          recontact_date: string | null;
          waiting_memo: string | null;
          termination_reason: TerminationReason | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          legacy_status?: string | null;
          name_vi?: string | null;
          name_kr?: string | null;
          address?: string | null;
          gender?: Gender | null;
          birth_year?: number | null;
          phone?: string | null;
          email?: string | null;
          visa_type?: string | null;
          topik_level?: string | null;
          stay_remaining?: string | null;
          desired_period?: string | null;
          desired_time?: DesiredTime | null;
          desired_region?: string | null;
          training_center_id?: string | null;
          training_class_id?: string | null;
          care_home_id?: string | null;
          class_start_date?: string | null;
          class_end_date?: string | null;
          work_start_date?: string | null;
          work_end_date?: string | null;
          visa_change_date?: string | null;
          interview_date?: string | null;
          product_type?: ProductType | null;
          is_waiting?: boolean;
          recontact_date?: string | null;
          waiting_memo?: string | null;
          termination_reason?: TerminationReason | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customers_training_center_id_fkey";
            columns: ["training_center_id"];
            referencedRelation: "training_centers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_training_class_id_fkey";
            columns: ["training_class_id"];
            referencedRelation: "training_classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_care_home_id_fkey";
            columns: ["care_home_id"];
            referencedRelation: "care_homes";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      customer_statuses: {
        Row: {
          customer_id: string;
          intake_abandoned: boolean;
          study_abroad_consultation: boolean;
          training_center_finding: boolean;
          class_schedule_confirmation_needed: boolean;
          training_reservation_abandoned: boolean;
          certificate_acquired: boolean;
          training_dropped: boolean;
          welcome_pack_abandoned: boolean;
          care_home_finding: boolean;
          resume_sent: boolean;
          interview_passed: boolean;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          intake_abandoned?: boolean;
          study_abroad_consultation?: boolean;
          training_center_finding?: boolean;
          class_schedule_confirmation_needed?: boolean;
          training_reservation_abandoned?: boolean;
          certificate_acquired?: boolean;
          training_dropped?: boolean;
          welcome_pack_abandoned?: boolean;
          care_home_finding?: boolean;
          resume_sent?: boolean;
          interview_passed?: boolean;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["customer_statuses"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "customer_statuses_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      customer_consultations: {
        Row: {
          id: string;
          customer_id: string;
          consultation_type: ConsultationType;
          content_vi: string | null;
          content_kr: string | null;
          tags: string[];
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          consultation_type: ConsultationType;
          content_vi?: string | null;
          content_kr?: string | null;
          tags?: string[];
          author_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["customer_consultations"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "customer_consultations_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      reservation_payments: {
        Row: {
          id: string;
          customer_id: string;
          amount: number;
          payment_date: string | null;
          refund_amount: number;
          refund_date: string | null;
          refund_reason: ReservationRefundReason | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          amount: number;
          payment_date?: string | null;
          refund_amount?: number;
          refund_date?: string | null;
          refund_reason?: ReservationRefundReason | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["reservation_payments"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "reservation_payments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      commission_payments: {
        Row: {
          id: string;
          customer_id: string;
          training_center_id: string;
          total_amount: number;
          deduction_amount: number;
          received_amount: number | null;
          received_date: string | null;
          tax_invoice_issued: boolean;
          tax_invoice_date: string | null;
          sms_sent_at: string | null;
          status: CommissionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          training_center_id: string;
          total_amount: number;
          deduction_amount?: number;
          received_amount?: number | null;
          received_date?: string | null;
          tax_invoice_issued?: boolean;
          tax_invoice_date?: string | null;
          sms_sent_at?: string | null;
          status?: CommissionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["commission_payments"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "commission_payments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_payments_training_center_id_fkey";
            columns: ["training_center_id"];
            referencedRelation: "training_centers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      event_payments: {
        Row: {
          id: string;
          customer_id: string;
          event_type: string;
          amount: number;
          gift_type: string | null;
          friend_customer_id: string | null;
          gift_given: boolean;
          gift_given_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          event_type: string;
          amount?: number;
          gift_type?: string | null;
          friend_customer_id?: string | null;
          gift_given?: boolean;
          gift_given_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "event_payments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_payments_friend_customer_id_fkey";
            columns: ["friend_customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      welcome_pack_payments: {
        Row: {
          id: string;
          customer_id: string;
          total_price: number;
          discount_amount: number;
          final_amount: number;
          reservation_amount: number;
          reservation_date: string | null;
          interim_amount: number;
          interim_date: string | null;
          balance_amount: number;
          balance_date: string | null;
          sales_reported: boolean;
          sales_reported_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          total_price?: number;
          discount_amount?: number;
          // final_amount는 generated column
          reservation_amount?: number;
          reservation_date?: string | null;
          interim_amount?: number;
          interim_date?: string | null;
          balance_amount?: number;
          balance_date?: string | null;
          sales_reported?: boolean;
          sales_reported_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["welcome_pack_payments"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "welcome_pack_payments_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      sms_messages: {
        Row: {
          id: string;
          message_type: string;
          target_customer_id: string | null;
          target_center_id: string | null;
          content: string;
          sent_at: string;
          sent_by: string | null;
        };
        Insert: {
          id?: string;
          message_type: string;
          target_customer_id?: string | null;
          target_center_id?: string | null;
          content: string;
          sent_at?: string;
          sent_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sms_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sms_messages_target_customer_id_fkey";
            columns: ["target_customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_messages_target_center_id_fkey";
            columns: ["target_center_id"];
            referencedRelation: "training_centers";
            referencedColumns: ["id"];
          }
        ];
      };

      // -----------------------------------------------------------------------
      system_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// =============================================================================
// 도우미 타입 — 어플리케이션 코드에서 사용
// =============================================================================

type PublicTables = Database["public"]["Tables"];

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> =
  PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> =
  PublicTables[T]["Update"];

// 자주 쓸 별칭
export type Customer = Tables<"customers">;
export type CustomerStatus = Tables<"customer_statuses">;
export type Consultation = Tables<"customer_consultations">;
export type TrainingCenter = Tables<"training_centers">;
export type TrainingClass = Tables<"training_classes">;
export type CareHome = Tables<"care_homes">;
export type ReservationPayment = Tables<"reservation_payments">;
export type CommissionPayment = Tables<"commission_payments">;
export type EventPayment = Tables<"event_payments">;
export type WelcomePackPayment = Tables<"welcome_pack_payments">;
export type SmsMessage = Tables<"sms_messages">;
export type SystemSetting = Tables<"system_settings">;
export type StatusOption = Tables<"status_options">;
