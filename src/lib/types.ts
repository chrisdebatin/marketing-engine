// Hand-written Supabase schema types. Keep in sync with supabase/migrations.
// (Can later be replaced by `supabase gen types typescript`.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "md" | "employee";
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
          md_email: string | null;
          ik_nummer: string | null;
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
          md_email?: string | null;
          ik_nummer?: string | null;
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
          md_email?: string | null;
          ik_nummer?: string | null;
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
          place_kind: string | null;
          ort: string | null;
          adresse: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hub_id: string;
          delivery_id?: string | null;
          standort_name: string;
          menge?: number | null;
          kind?: string;
          place_kind?: string | null;
          ort?: string | null;
          adresse?: string | null;
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
          source: string;
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
          source?: string;
          note?: string | null;
          verified_at?: string | null;
          created_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_records"]["Insert"]>;
        Relationships: [];
      };
      patient_flows: {
        Row: {
          id: string;
          hub_id: string;
          period: string;
          flow: string;
          leistung: string;
          display_name: string;
          reference_id: string | null;
          abgang_grund: string | null;
          event_date: string | null;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          hub_id: string;
          period: string;
          flow: string;
          leistung: string;
          display_name: string;
          reference_id?: string | null;
          abgang_grund?: string | null;
          event_date?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["patient_flows"]["Insert"]>;
        Relationships: [];
      };
      flyer_actions: {
        Row: {
          id: string;
          action_date: string;
          anzahl: number;
          plz: string;
          inhalt: string;
          note: string | null;
          ort: string | null;
          hub_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          action_date?: string;
          anzahl: number;
          plz: string;
          inhalt: string;
          note?: string | null;
          ort?: string | null;
          hub_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["flyer_actions"]["Insert"]>;
        Relationships: [];
      };
      ms_oauth_tokens: {
        Row: {
          id: string;
          account_email: string | null;
          refresh_token: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_email?: string | null;
          refresh_token: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["ms_oauth_tokens"]["Insert"]
        >;
        Relationships: [];
      };
      hub_notes: {
        Row: {
          id: string;
          hub_id: string;
          text: string;
          is_todo: boolean;
          done_at: string | null;
          topic_id: string | null;
          status: string | null;
          tag: string | null;
          images: Json | null;
          notiz: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          hub_id: string;
          text: string;
          notiz?: string | null;
          is_todo?: boolean;
          done_at?: string | null;
          topic_id?: string | null;
          status?: string | null;
          tag?: string | null;
          images?: Json | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["hub_notes"]["Insert"]>;
        Relationships: [];
      };
      crm_targets: {
        Row: {
          id: string;
          hub_id: string | null;
          name: string;
          kategorie: string | null;
          adresse: string | null;
          ort: string | null;
          note: string | null;
          intervall_wochen: number;
          letzter_besuch: string | null;
          naechster_besuch: string | null;
          besuchs_notiz: string | null;
          ansprechpartner: string | null;
          letzte_kontakt_art: string | null;
          recare_partner: boolean | null;
          plan: string | null;
          relevanz: number | null;
          geo_tag: string | null;
          kurzinfo: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          hub_id?: string | null;
          name: string;
          kategorie?: string | null;
          adresse?: string | null;
          ort?: string | null;
          note?: string | null;
          intervall_wochen?: number;
          letzter_besuch?: string | null;
          naechster_besuch?: string | null;
          besuchs_notiz?: string | null;
          ansprechpartner?: string | null;
          letzte_kontakt_art?: string | null;
          recare_partner?: boolean | null;
          plan?: string | null;
          relevanz?: number | null;
          geo_tag?: string | null;
          kurzinfo?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["crm_targets"]["Insert"]>;
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: unknown; updated_at: string | null };
        Insert: { key: string; value: unknown; updated_at?: string | null };
        Update: Partial<
          Database["public"]["Tables"]["app_settings"]["Insert"]
        >;
        Relationships: [];
      };
      personal_ads: {
        Row: {
          id: string;
          titel: string;
          plattform: string;
          hub_id: string | null;
          start_date: string;
          end_date: string | null;
          link: string | null;
          notiz: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          titel: string;
          plattform: string;
          hub_id?: string | null;
          start_date?: string;
          end_date?: string | null;
          link?: string | null;
          notiz?: string | null;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["personal_ads"]["Insert"]
        >;
        Relationships: [];
      };
      meta_ads: {
        Row: {
          id: string;
          name: string;
          typ: string;
          hub_id: string | null;
          start_date: string;
          end_date: string | null;
          budget: string | null;
          ziel: string | null;
          link: string | null;
          notiz: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          typ: string;
          hub_id?: string | null;
          start_date?: string;
          end_date?: string | null;
          budget?: string | null;
          ziel?: string | null;
          link?: string | null;
          notiz?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meta_ads"]["Insert"]>;
        Relationships: [];
      };
      meta_creatives: {
        Row: {
          id: string;
          name: string;
          path: string;
          url: string;
          mime: string;
          size_bytes: number;
          notiz: string | null;
          meta_video_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          path: string;
          url: string;
          mime: string;
          size_bytes?: number;
          notiz?: string | null;
          meta_video_id?: string | null;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["meta_creatives"]["Insert"]
        >;
        Relationships: [];
      };
      pdl_versuche: {
        Row: {
          id: string;
          hub_id: string;
          lead_kind: string | null;
          lead_id: string | null;
          erreicht: boolean;
          von: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          hub_id: string;
          lead_kind?: string | null;
          lead_id?: string | null;
          erreicht: boolean;
          von?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pdl_versuche"]["Insert"]>;
        Relationships: [];
      };
      lead_todos: {
        Row: {
          id: string;
          lead_kind: string;
          lead_id: string;
          text: string;
          faellig_am: string | null;
          erledigt_at: string | null;
          erstellt_von: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          lead_kind: string;
          lead_id: string;
          text: string;
          faellig_am?: string | null;
          erledigt_at?: string | null;
          erstellt_von?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["lead_todos"]["Insert"]>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          name: string;
          team: string;
          token: string;
          active: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          team: string;
          token?: string;
          active?: boolean;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
        Relationships: [];
      };
      meta_leads: {
        Row: {
          id: string;
          form_id: string | null;
          campaign_name: string | null;
          ad_name: string | null;
          created_time: string | null;
          field_data: unknown;
          status: string;
          created_at: string | null;
          followup_subject: string | null;
          followup_body: string | null;
          followup_status: string | null;
          followup_sent_at: string | null;
          followup_error: string | null;
          forwarded_at: string | null;
          forward_error: string | null;
          crm_target_id: string | null;
          bearbeiter: string | null;
          zugewiesen_hub_id: string | null;
          zugewiesen_at: string | null;
          pdl_bestaetigt_at: string | null;
          pdl_ergebnis: string | null;
          ergebnis: string | null;
          erstbearbeitet_at: string | null;
          notiz: string | null;
          adresse: string | null;
        };
        Insert: {
          id: string;
          form_id?: string | null;
          campaign_name?: string | null;
          ad_name?: string | null;
          created_time?: string | null;
          field_data?: unknown;
          status?: string;
          created_at?: string | null;
          followup_subject?: string | null;
          followup_body?: string | null;
          followup_status?: string | null;
          followup_sent_at?: string | null;
          followup_error?: string | null;
          forwarded_at?: string | null;
          forward_error?: string | null;
          crm_target_id?: string | null;
          bearbeiter?: string | null;
          zugewiesen_hub_id?: string | null;
          zugewiesen_at?: string | null;
          pdl_bestaetigt_at?: string | null;
          pdl_ergebnis?: string | null;
          ergebnis?: string | null;
          erstbearbeitet_at?: string | null;
          notiz?: string | null;
          adresse?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meta_leads"]["Insert"]>;
        Relationships: [];
      };
      lead_calls: {
        Row: {
          id: string;
          call_date: string;
          quelle: string;
          bereich: string | null;
          quelle_detail: string | null;
          lead_name: string | null;
          hub_id: string | null;
          target_id: string | null;
          notiz: string | null;
          bearbeiter: string | null;
          status: string;
          telefon: string | null;
          email: string | null;
          ergebnis: string | null;
          zugewiesen_hub_id: string | null;
          zugewiesen_at: string | null;
          pdl_bestaetigt_at: string | null;
          pdl_ergebnis: string | null;
          erstbearbeitet_at: string | null;
          created_at: string | null;
          adresse: string | null;
        };
        Insert: {
          id?: string;
          call_date?: string;
          quelle: string;
          bereich?: string | null;
          quelle_detail?: string | null;
          lead_name?: string | null;
          hub_id?: string | null;
          target_id?: string | null;
          notiz?: string | null;
          bearbeiter?: string | null;
          status?: string;
          telefon?: string | null;
          email?: string | null;
          ergebnis?: string | null;
          zugewiesen_hub_id?: string | null;
          zugewiesen_at?: string | null;
          pdl_bestaetigt_at?: string | null;
          pdl_ergebnis?: string | null;
          erstbearbeitet_at?: string | null;
          created_at?: string | null;
          adresse?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["lead_calls"]["Insert"]>;
        Relationships: [];
      };
      capacity_reports: {
        Row: {
          id: string;
          hub_id: string;
          week_start: string;
          freie_plaetze: number;
          beatmung_plaetze: number;
          wg_plaetze: number;
          kinder_moeglich: boolean;
          pflege_score: number | null;
          alltagshilfe_score: number | null;
          wundversorgung_score: number | null;
          aufnahme_ab: string | null;
          notiz: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          hub_id: string;
          week_start: string;
          freie_plaetze?: number;
          beatmung_plaetze?: number;
          wg_plaetze?: number;
          kinder_moeglich?: boolean;
          pflege_score?: number | null;
          alltagshilfe_score?: number | null;
          wundversorgung_score?: number | null;
          aufnahme_ab?: string | null;
          notiz?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["capacity_reports"]["Insert"]
        >;
        Relationships: [];
      };
      phone_calls: {
        Row: {
          id: string;
          call_id: string;
          call_time: string;
          hub_name: string | null;
          direction: string;
          answered: boolean;
          talking_seconds: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          call_id: string;
          call_time: string;
          hub_name?: string | null;
          direction: string;
          answered?: boolean;
          talking_seconds?: number;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["phone_calls"]["Insert"]
        >;
        Relationships: [];
      };
      bewerber: {
        Row: {
          id: string;
          quelle: string;
          quelle_id: string;
          name: string;
          telefon: string | null;
          email: string | null;
          rolle: string | null;
          kampagne: string | null;
          hub_id: string | null;
          score: number | null;
          score_grund: string | null;
          status: string;
          notiz: string | null;
          weitergeleitet_von: string | null;
          zugewiesen_at: string;
          erstkontakt_at: string | null;
          abgeschlossen_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          quelle: string;
          quelle_id: string;
          name: string;
          telefon?: string | null;
          email?: string | null;
          rolle?: string | null;
          kampagne?: string | null;
          hub_id?: string | null;
          score?: number | null;
          score_grund?: string | null;
          status?: string;
          notiz?: string | null;
          weitergeleitet_von?: string | null;
          zugewiesen_at?: string;
          erstkontakt_at?: string | null;
          abgeschlossen_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bewerber"]["Insert"]>;
        Relationships: [];
      };
      pdl_auftraege: {
        Row: {
          id: string;
          target_id: string;
          hub_id: string | null;
          text: string;
          anruf_datum: string;
          anruf_von: string | null;
          ansprechpartner: string | null;
          anruf_notiz: string | null;
          status: string;
          erledigt_at: string | null;
          erledigt_von: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          target_id: string;
          hub_id?: string | null;
          text: string;
          anruf_datum: string;
          anruf_von?: string | null;
          ansprechpartner?: string | null;
          anruf_notiz?: string | null;
          status?: string;
          erledigt_at?: string | null;
          erledigt_von?: string | null;
          created_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["pdl_auftraege"]["Insert"]
        >;
        Relationships: [];
      };
      crm_contacts: {
        Row: {
          id: string;
          target_id: string;
          hub_id: string | null;
          kontakt_art: string;
          ansprechpartner: string | null;
          note: string | null;
          contact_date: string;
          bearbeiter: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          target_id: string;
          hub_id?: string | null;
          kontakt_art: string;
          ansprechpartner?: string | null;
          note?: string | null;
          contact_date?: string;
          bearbeiter?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["crm_contacts"]["Insert"]>;
        Relationships: [];
      };
      crm_persons: {
        Row: {
          id: string;
          target_id: string;
          name: string;
          funktion: string | null;
          telefon: string | null;
          email: string | null;
          notiz: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          target_id: string;
          name: string;
          funktion?: string | null;
          telefon?: string | null;
          email?: string | null;
          notiz?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["crm_persons"]["Insert"]>;
        Relationships: [];
      };
      crm_todos: {
        Row: {
          id: string;
          target_id: string;
          hub_id: string | null;
          contact_id: string | null;
          art: string;
          aufgabe: string;
          besprochen: string | null;
          status: string;
          created_at: string | null;
          done_at: string | null;
        };
        Insert: {
          id?: string;
          target_id: string;
          hub_id?: string | null;
          contact_id?: string | null;
          art?: string;
          aufgabe: string;
          besprochen?: string | null;
          status?: string;
          created_at?: string | null;
          done_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["crm_todos"]["Insert"]>;
        Relationships: [];
      };
      note_topics: {
        Row: {
          id: string;
          title: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["note_topics"]["Insert"]>;
        Relationships: [];
      };
      hub_tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["hub_tasks"]["Insert"]>;
        Relationships: [];
      };
      hub_task_checks: {
        Row: {
          task_id: string;
          hub_id: string;
          note: string | null;
          done_at: string;
        };
        Insert: {
          task_id: string;
          hub_id: string;
          note?: string | null;
          done_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["hub_task_checks"]["Insert"]
        >;
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
  /**
   * Mitarbeiter-App — eigenes Postgres-Schema, strikt getrennt vom CRM.
   *
   * Voraussetzung: "employee_app" muss im Supabase-Dashboard unter
   * Settings -> API -> Exposed schemas eingetragen sein, sonst antwortet
   * PostgREST mit PGRST106 (auch fuer den Service-Role-Client).
   *
   * Zugriff nur ueber createEmployeeClient() in src/lib/employee/db.ts.
   * Wie im public-Block gilt: jede Tabelle braucht `Relationships: []`,
   * sonst kollabiert der typisierte Client zu `never`. Embedded-Relation-
   * Selects sind hier ohnehin unmoeglich (schemauebergreifend) — immer
   * zwei einfache Queries + JS-Map.
   */
  employee_app: {
    Tables: {
      staff: {
        Row: {
          id: string;
          hub_id: string | null;
          vorname: string;
          nachname: string;
          personalnr: string | null;
          rolle: EmployeeRolle;
          status: EmployeeStatus;
          profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hub_id?: string | null;
          vorname: string;
          nachname: string;
          personalnr?: string | null;
          rolle?: EmployeeRolle;
          status?: EmployeeStatus;
          profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hub_id?: string | null;
          vorname?: string;
          nachname?: string;
          personalnr?: string | null;
          rolle?: EmployeeRolle;
          status?: EmployeeStatus;
          profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activation_codes: {
        Row: {
          id: string;
          staff_id: string;
          code_hash: string;
          code_hint: string | null;
          expires_at: string;
          used_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          code_hash: string;
          code_hint?: string | null;
          expires_at?: string;
          used_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          code_hash?: string;
          code_hint?: string | null;
          expires_at?: string;
          used_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          staff_id: string;
          secret_hash: string;
          label: string | null;
          pin_hash: string | null;
          pin_set_at: string | null;
          failed_count: number;
          lock_count: number;
          locked_until: string | null;
          created_at: string;
          last_seen_at: string;
          revoked_at: string | null;
          revoked_reason: string | null;
        };
        Insert: {
          id?: string;
          staff_id: string;
          secret_hash: string;
          label?: string | null;
          pin_hash?: string | null;
          pin_set_at?: string | null;
          failed_count?: number;
          lock_count?: number;
          locked_until?: string | null;
          created_at?: string;
          last_seen_at?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
        };
        Update: {
          id?: string;
          staff_id?: string;
          secret_hash?: string;
          label?: string | null;
          pin_hash?: string | null;
          pin_set_at?: string | null;
          failed_count?: number;
          lock_count?: number;
          locked_until?: string | null;
          created_at?: string;
          last_seen_at?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          staff_id: string;
          device_id: string;
          token_hash: string;
          created_at: string;
          last_seen_at: string;
          expires_at: string;
          revoked_at: string | null;
          revoked_reason: string | null;
        };
        Insert: {
          id?: string;
          staff_id: string;
          device_id: string;
          token_hash: string;
          created_at?: string;
          last_seen_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
        };
        Update: {
          id?: string;
          staff_id?: string;
          device_id?: string;
          token_hash?: string;
          created_at?: string;
          last_seen_at?: string;
          expires_at?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
        };
        Relationships: [];
      };
      auth_attempts: {
        Row: {
          id: number;
          bucket: string;
          kind: "pin" | "activation";
          ok: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          bucket: string;
          kind: "pin" | "activation";
          ok: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          bucket?: string;
          kind?: "pin" | "activation";
          ok?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          titel: string;
          body: string;
          image_url: string | null;
          status: AnnouncementStatus;
          prioritaet: AnnouncementPrioritaet;
          publish_at: string;
          target_scope: AnnouncementTargetScope;
          target_hub_ids: string[];
          target_regions: string[];
          target_rollen: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titel: string;
          body: string;
          image_url?: string | null;
          status?: AnnouncementStatus;
          prioritaet?: AnnouncementPrioritaet;
          publish_at?: string;
          target_scope?: AnnouncementTargetScope;
          target_hub_ids?: string[];
          target_regions?: string[];
          target_rollen?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          titel?: string;
          body?: string;
          image_url?: string | null;
          status?: AnnouncementStatus;
          prioritaet?: AnnouncementPrioritaet;
          publish_at?: string;
          target_scope?: AnnouncementTargetScope;
          target_hub_ids?: string[];
          target_regions?: string[];
          target_rollen?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcement_reads: {
        Row: { announcement_id: string; staff_id: string; read_at: string };
        Insert: { announcement_id: string; staff_id: string; read_at?: string };
        Update: { announcement_id?: string; staff_id?: string; read_at?: string };
        Relationships: [];
      };
      customer_referrals: {
        Row: {
          id: string;
          staff_id: string;
          hub_id: string | null;
          kunde_name: string;
          telefon: string | null;
          email: string | null;
          ort: string | null;
          beziehung: string | null;
          notiz: string | null;
          consent_at: string;
          consent_version: string;
          status: CustomerReferralStatus;
          status_notiz: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          hub_id?: string | null;
          kunde_name: string;
          telefon?: string | null;
          email?: string | null;
          ort?: string | null;
          beziehung?: string | null;
          notiz?: string | null;
          consent_at?: string;
          consent_version?: string;
          status?: CustomerReferralStatus;
          status_notiz?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          hub_id?: string | null;
          kunde_name?: string;
          telefon?: string | null;
          email?: string | null;
          ort?: string | null;
          beziehung?: string | null;
          notiz?: string | null;
          consent_at?: string;
          consent_version?: string;
          status?: CustomerReferralStatus;
          status_notiz?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ma_referrals: {
        Row: {
          id: string;
          staff_id: string;
          hub_id: string | null;
          firma_name: string;
          inhaber_name: string | null;
          telefon: string | null;
          email: string | null;
          ort: string | null;
          beziehung: string | null;
          notiz: string | null;
          status: MaReferralStatus;
          status_notiz: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          hub_id?: string | null;
          firma_name: string;
          inhaber_name?: string | null;
          telefon?: string | null;
          email?: string | null;
          ort?: string | null;
          beziehung?: string | null;
          notiz?: string | null;
          status?: MaReferralStatus;
          status_notiz?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          hub_id?: string | null;
          firma_name?: string;
          inhaber_name?: string | null;
          telefon?: string | null;
          email?: string | null;
          ort?: string | null;
          beziehung?: string | null;
          notiz?: string | null;
          status?: MaReferralStatus;
          status_notiz?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: number;
          staff_id: string | null;
          art: string;
          ziel_art: string | null;
          ziel_id: string | null;
          ip_hash: string | null;
          meta: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: number;
          staff_id?: string | null;
          art: string;
          ziel_art?: string | null;
          ziel_id?: string | null;
          ip_hash?: string | null;
          meta?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: number;
          staff_id?: string | null;
          art?: string;
          ziel_art?: string | null;
          ziel_id?: string | null;
          ip_hash?: string | null;
          meta?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/* ---------------------------------------------------------------
 * Mitarbeiter-App: Status-Unions.
 * Bewusst TS-Unions statt Postgres-Enums — im gesamten Repo gibt es
 * keinen `create type`; die Konvention ist `text` + `check`.
 * --------------------------------------------------------------- */
export type EmployeeRolle = "mitarbeiter" | "hubleiter" | "admin";
export type EmployeeStatus =
  | "eingeladen"
  | "aktiv"
  | "gesperrt"
  | "ausgeschieden";
export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementPrioritaet = "normal" | "wichtig";
export type AnnouncementTargetScope = "all" | "hub" | "region" | "rolle";
export type CustomerReferralStatus =
  | "submitted"
  | "contacted"
  | "qualified"
  | "converted"
  | "rejected"
  | "bonus_eligible"
  | "bonus_paid";
export type MaReferralStatus =
  | "submitted"
  | "reviewing"
  | "contacted"
  | "qualified"
  | "negotiating"
  | "acquired"
  | "rejected"
  | "bonus_eligible"
  | "bonus_paid";

// Convenience row aliases — Mitarbeiter-App
type EmpTables = Database["employee_app"]["Tables"];
export type Staff = EmpTables["staff"]["Row"];
export type ActivationCode = EmpTables["activation_codes"]["Row"];
export type EmployeeDevice = EmpTables["devices"]["Row"];
export type EmployeeSession = EmpTables["sessions"]["Row"];
export type Announcement = EmpTables["announcements"]["Row"];
export type CustomerReferral = EmpTables["customer_referrals"]["Row"];
export type MaReferral = EmpTables["ma_referrals"]["Row"];

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
export type PatientFlow = Database["public"]["Tables"]["patient_flows"]["Row"];
export type HubTask = Database["public"]["Tables"]["hub_tasks"]["Row"];
export type HubTaskCheck = Database["public"]["Tables"]["hub_task_checks"]["Row"];
