// Hand-written Supabase schema types. Keep in sync with supabase/migrations.
// (Can later be replaced by `supabase gen types typescript`.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "employee";
export type ActivityType = "flyer" | "box";

export interface Database {
  public: {
    Tables: {
      hubs: {
        Row: {
          id: string;
          name: string;
          region: string | null;
          address: string | null;
          responsible_md: string | null;
          pdl_name: string | null;
          pdl_email: string | null;
          pdl_phone: string | null;
          share_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          region?: string | null;
          address?: string | null;
          responsible_md?: string | null;
          pdl_name?: string | null;
          pdl_email?: string | null;
          pdl_phone?: string | null;
          share_token?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          region?: string | null;
          address?: string | null;
          responsible_md?: string | null;
          pdl_name?: string | null;
          pdl_email?: string | null;
          pdl_phone?: string | null;
          share_token?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; name: string | null; role: UserRole; created_at: string };
        Insert: { id: string; name?: string | null; role?: UserRole; created_at?: string };
        Update: { id?: string; name?: string | null; role?: UserRole; created_at?: string };
        Relationships: [];
      };
      user_hubs: {
        Row: { user_id: string; hub_id: string };
        Insert: { user_id: string; hub_id: string };
        Update: { user_id?: string; hub_id?: string };
        Relationships: [];
      };
      material_types: {
        Row: { id: string; name: string; sort_order: number };
        Insert: { id?: string; name: string; sort_order?: number };
        Update: { id?: string; name?: string; sort_order?: number };
        Relationships: [];
      };
      standorte: {
        Row: {
          id: string;
          hub_id: string;
          name: string;
          typ: string | null;
          adresse: string | null;
          plz: string | null;
          ort: string | null;
          external_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hub_id: string;
          name: string;
          typ?: string | null;
          adresse?: string | null;
          plz?: string | null;
          ort?: string | null;
          external_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["standorte"]["Insert"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          hub_id: string;
          standort_name: string;
          type: ActivityType;
          occurred_on: string;
          note: string | null;
          details: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          hub_id: string;
          standort_name: string;
          type: ActivityType;
          occurred_on?: string;
          note?: string | null;
          details: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hub_id?: string;
          standort_name?: string;
          type?: ActivityType;
          occurred_on?: string;
          note?: string | null;
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      deliveries: {
        Row: {
          id: string;
          hub_id: string;
          delivered_by: string | null;
          flyer_count: number;
          box_count: number;
          aufsteller_count: number;
          note: string | null;
          share_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          hub_id: string;
          delivered_by?: string | null;
          flyer_count?: number;
          box_count?: number;
          aufsteller_count?: number;
          note?: string | null;
          share_token: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deliveries"]["Insert"]>;
        Relationships: [];
      };
      delivery_placements: {
        Row: {
          id: string;
          hub_id: string;
          delivery_id: string | null;
          standort_name: string;
          menge: number | null;
          kind: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          hub_id: string;
          delivery_id?: string | null;
          standort_name: string;
          menge?: number | null;
          kind?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["delivery_placements"]["Insert"]
        >;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          hub_id: string | null;
          hub_input: string | null;
          material: string | null;
          quantity: number | null;
          status: string;
          source: string;
          note: string | null;
          email_from: string | null;
          email_subject: string | null;
          received_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hub_id?: string | null;
          hub_input?: string | null;
          material?: string | null;
          quantity?: number | null;
          status?: string;
          source?: string;
          note?: string | null;
          email_from?: string | null;
          email_subject?: string | null;
          received_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      material_catalog: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          category: string | null;
          active: boolean;
          sort_order: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description?: string | null;
          category?: string | null;
          active?: boolean;
          sort_order?: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["material_catalog"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          material_key: string;
          quantity: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          material_key: string;
          quantity: number;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
      patient_batches: {
        Row: {
          id: string;
          hub_id: string;
          period: string;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          hub_id: string;
          period: string;
          note?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["patient_batches"]["Insert"]>;
        Relationships: [];
      };
      patient_records: {
        Row: {
          id: string;
          batch_id: string;
          hub_id: string;
          display_name: string;
          reference_id: string | null;
          status: string;
          note: string | null;
          verified_at: string | null;
          created_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          hub_id: string;
          display_name: string;
          reference_id?: string | null;
          status?: string;
          note?: string | null;
          verified_at?: string | null;
          created_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_records"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      has_hub: { Args: { hid: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row aliases
export type Hub = Database["public"]["Tables"]["hubs"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type MaterialType = Database["public"]["Tables"]["material_types"]["Row"];
export type Standort = Database["public"]["Tables"]["standorte"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type DeliveryPlacement =
  Database["public"]["Tables"]["delivery_placements"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type MaterialCatalogItem =
  Database["public"]["Tables"]["material_catalog"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type PatientBatch = Database["public"]["Tables"]["patient_batches"]["Row"];
export type PatientRecord = Database["public"]["Tables"]["patient_records"]["Row"];
