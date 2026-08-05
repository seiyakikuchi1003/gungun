// 自動生成ファイル。手で編集しないこと。
//
//   export SUPABASE_ACCESS_TOKEN=...   # .env.local にあり
//   npx supabase gen types typescript --project-id bypjhlfcqzebmukwzthi --schema public > src/types/database.ts
//
// 手書きの src/types/db.ts は当面そのまま（画面側が参照している）。
// 新しく型が要る箇所からこちらに寄せていく。

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
      _gungun_migrations: {
        Row: {
          applied_at: string
          filename: string
        }
        Insert: {
          applied_at?: string
          filename: string
        }
        Update: {
          applied_at?: string
          filename?: string
        }
        Relationships: []
      }
      addresses: {
        Row: {
          building: string | null
          city: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          phone: string
          postal_code: string
          prefecture: string
          street: string
          user_id: string
        }
        Insert: {
          building?: string | null
          city: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          phone: string
          postal_code: string
          prefecture: string
          street: string
          user_id: string
        }
        Update: {
          building?: string | null
          city?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          postal_code?: string
          prefecture?: string
          street?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor: string
          created_at: string
          detail: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          image_url: string | null
          pinned: boolean
          tag: Database["public"]["Enums"]["board_tag"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          pinned?: boolean
          tag?: Database["public"]["Enums"]["board_tag"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          pinned?: boolean
          tag?: Database["public"]["Enums"]["board_tag"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchanges: {
        Row: {
          from_user_id: string | null
          harvest_id: string
          id: string
          item_id: string | null
          position: number
          received_at: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["exchange_status"]
          to_user_id: string | null
        }
        Insert: {
          from_user_id?: string | null
          harvest_id: string
          id?: string
          item_id?: string | null
          position: number
          received_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["exchange_status"]
          to_user_id?: string | null
        }
        Update: {
          from_user_id?: string | null
          harvest_id?: string
          id?: string
          item_id?: string | null
          position?: number
          received_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["exchange_status"]
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchanges_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "harvests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "exchanges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchanges_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fertilizer_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["fertilizer_reason"]
          related_item_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["fertilizer_reason"]
          related_item_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["fertilizer_reason"]
          related_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fertilizer_ledger_related_item_id_fkey"
            columns: ["related_item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fertilizer_ledger_related_item_id_fkey"
            columns: ["related_item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fertilizer_ledger_related_item_id_fkey"
            columns: ["related_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fertilizer_ledger_related_item_id_fkey"
            columns: ["related_item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fertilizer_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fertilizer_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      harvests: {
        Row: {
          created_at: string
          harvested_item_id: string | null
          id: string
          root_item_id: string | null
        }
        Insert: {
          created_at?: string
          harvested_item_id?: string | null
          id?: string
          root_item_id?: string | null
        }
        Update: {
          created_at?: string
          harvested_item_id?: string | null
          id?: string
          root_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "harvests_harvested_item_id_fkey"
            columns: ["harvested_item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_harvested_item_id_fkey"
            columns: ["harvested_item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "harvests_harvested_item_id_fkey"
            columns: ["harvested_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_harvested_item_id_fkey"
            columns: ["harvested_item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["root_item_id"]
            isOneToOne: true
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["root_item_id"]
            isOneToOne: true
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["root_item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["root_item_id"]
            isOneToOne: true
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_images: {
        Row: {
          id: string
          item_id: string
          sort_order: number
          url: string
        }
        Insert: {
          id?: string
          item_id: string
          sort_order?: number
          url: string
        }
        Update: {
          id?: string
          item_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_likes: {
        Row: {
          created_at: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_views: {
        Row: {
          item_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          item_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          item_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_views_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          condition: string
          created_at: string
          depth: number
          description: string | null
          id: string
          name: string
          parent_id: string | null
          root_id: string
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          condition: string
          created_at?: string
          depth?: number
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          root_id: string
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          depth?: number
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          root_id?: string
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_users: {
        Row: {
          created_at: string
          email: string
          invited_at: string | null
          legacy_id: string
          migrated_at: string | null
          nickname: string | null
          profile_id: string | null
          raw: Json | null
        }
        Insert: {
          created_at?: string
          email: string
          invited_at?: string | null
          legacy_id: string
          migrated_at?: string | null
          nickname?: string | null
          profile_id?: string | null
          raw?: Json | null
        }
        Update: {
          created_at?: string
          email?: string
          invited_at?: string | null
          legacy_id?: string
          migrated_at?: string | null
          nickname?: string | null
          profile_id?: string | null
          raw?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          exchange_id: string
          id: string
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          exchange_id: string
          id?: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          exchange_id?: string
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          pushed_at: string | null
          read_at: string | null
          related_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          related_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          related_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          fertilizer: number
          id: string
          is_premium: boolean
          is_suspended: boolean
          last_login_bonus_on: string | null
          nickname: string
          premium_until: string | null
          suspended_reason: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          fertilizer?: number
          id: string
          is_premium?: boolean
          is_suspended?: boolean
          last_login_bonus_on?: string | null
          nickname: string
          premium_until?: string | null
          suspended_reason?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          fertilizer?: number
          id?: string
          is_premium?: boolean
          is_suspended?: boolean
          last_login_bonus_on?: string | null
          nickname?: string
          premium_until?: string | null
          suspended_reason?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          fertilizer_amount: number
          id: string
          kind: Database["public"]["Enums"]["purchase_kind"]
          platform: Database["public"]["Enums"]["purchase_platform"]
          premium_days: number
          price_jpy: number | null
          product_id: string
          raw: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fertilizer_amount?: number
          id?: string
          kind: Database["public"]["Enums"]["purchase_kind"]
          platform: Database["public"]["Enums"]["purchase_platform"]
          premium_days?: number
          price_jpy?: number | null
          product_id: string
          raw?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          fertilizer_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
          platform?: Database["public"]["Enums"]["purchase_platform"]
          premium_days?: number
          price_jpy?: number | null
          product_id?: string
          raw?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          exchange_id: string
          id: string
          ratee_id: string | null
          rater_id: string | null
          score: number
          type: Database["public"]["Enums"]["rating_type"]
        }
        Insert: {
          comment?: string | null
          created_at?: string
          exchange_id: string
          id?: string
          ratee_id?: string | null
          rater_id?: string | null
          score: number
          type: Database["public"]["Enums"]["rating_type"]
        }
        Update: {
          comment?: string | null
          created_at?: string
          exchange_id?: string
          id?: string
          ratee_id?: string | null
          rater_id?: string | null
          score?: number
          type?: Database["public"]["Enums"]["rating_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ratings_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_note: string | null
          id: string
          reason: string | null
          reporter_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_note?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_note?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      board_cards: {
        Row: {
          author_avatar_url: string | null
          author_nickname: string | null
          body: string | null
          comment_count: number | null
          created_at: string | null
          id: string | null
          image_url: string | null
          like_count: number | null
          pinned: boolean | null
          tag: Database["public"]["Enums"]["board_tag"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_cards: {
        Row: {
          category: string | null
          comment_count: number | null
          condition: string | null
          created_at: string | null
          depth: number | null
          description: string | null
          id: string | null
          image_url: string | null
          image_urls: string[] | null
          like_count: number | null
          liked: boolean | null
          name: string | null
          owner_avatar_url: string | null
          owner_nickname: string | null
          parent_id: string | null
          root_id: string | null
          status: Database["public"]["Enums"]["item_status"] | null
          tree_count: number | null
          user_id: string | null
          water_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_water_counts: {
        Row: {
          item_id: string | null
          tree_count: number | null
          water_count: number | null
        }
        Insert: {
          item_id?: string | null
          tree_count?: never
          water_count?: never
        }
        Update: {
          item_id?: string | null
          tree_count?: never
          water_count?: never
        }
        Relationships: []
      }
      legacy_migration_status: {
        Row: {
          invited_not_yet: number | null
          migrated: number | null
          not_invited: number | null
          total: number | null
        }
        Relationships: []
      }
      notifications_to_push: {
        Row: {
          body: string | null
          created_at: string | null
          id: string | null
          platform: string | null
          related_id: string | null
          token: string | null
          type: Database["public"]["Enums"]["notification_type"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_stats: {
        Row: {
          harvest_count: number | null
          id: string | null
          rating_avg: number | null
          rating_count: number | null
          seed_count: number | null
          water_count: number | null
        }
        Insert: {
          harvest_count?: never
          id?: string | null
          rating_avg?: never
          rating_count?: never
          seed_count?: never
          water_count?: never
        }
        Update: {
          harvest_count?: never
          id?: string | null
          rating_avg?: never
          rating_count?: never
          seed_count?: never
          water_count?: never
        }
        Relationships: []
      }
      rating_cards: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          ratee_id: string | null
          rater_avatar_url: string | null
          rater_id: string | null
          rater_nickname: string | null
          score: number | null
          type: Database["public"]["Enums"]["rating_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sapling_items: {
        Row: {
          category: string | null
          created_at: string | null
          detached_from_root: string | null
          id: string | null
          name: string | null
          root_id: string | null
          status: Database["public"]["Enums"]["item_status"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["detached_from_root"]
            isOneToOne: true
            referencedRelation: "item_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["detached_from_root"]
            isOneToOne: true
            referencedRelation: "item_water_counts"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["detached_from_root"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_root_item_id_fkey"
            columns: ["detached_from_root"]
            isOneToOne: true
            referencedRelation: "sapling_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assert_not_suspended: { Args: { p_user: string }; Returns: undefined }
      can_claim_login_bonus: { Args: never; Returns: boolean }
      can_water: {
        Args: { p_target_id: string; p_user_id: string }
        Returns: boolean
      }
      claim_login_bonus: { Args: never; Returns: number }
      delete_item: { Args: { p_item_id: string }; Returns: undefined }
      delete_own_account: { Args: never; Returns: undefined }
      detach_children: {
        Args: { p_exclude_id?: string; p_item_id: string }
        Returns: undefined
      }
      expire_premium: { Args: never; Returns: number }
      get_ancestors: {
        Args: { target_id: string }
        Returns: {
          category: string
          condition: string
          created_at: string
          depth: number
          description: string | null
          id: string
          name: string
          parent_id: string | null
          root_id: string
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_setting_int: { Args: { p_key: string }; Returns: number }
      harvest: {
        Args: { p_root_id: string; p_target_id: string }
        Returns: string
      }
      harvest_unchecked: {
        Args: { p_root_id: string; p_target_id: string }
        Returns: string
      }
      is_suspended: { Args: { p_user: string }; Returns: boolean }
      mark_notifications_read: {
        Args: { p_ids?: string[] }
        Returns: undefined
      }
      my_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          fertilizer: number
          id: string
          is_premium: boolean
          is_suspended: boolean
          last_login_bonus_on: string | null
          nickname: string
          premium_until: string | null
          suspended_reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      plant_seed: {
        Args: {
          p_category: string
          p_condition: string
          p_description: string
          p_images?: string[]
          p_name: string
          p_user_id: string
        }
        Returns: string
      }
      receive_exchange: { Args: { p_exchange_id: string }; Returns: undefined }
      redeem_purchase: {
        Args: {
          p_fertilizer?: number
          p_kind: Database["public"]["Enums"]["purchase_kind"]
          p_platform: Database["public"]["Enums"]["purchase_platform"]
          p_premium_days?: number
          p_price_jpy?: number
          p_product_id: string
          p_raw?: Json
          p_transaction_id: string
          p_user: string
        }
        Returns: boolean
      }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      ship_exchange: { Args: { p_exchange_id: string }; Returns: undefined }
      submit_rating: {
        Args: { p_comment?: string; p_exchange_id: string; p_score: number }
        Returns: undefined
      }
      touch_item_view: { Args: { p_item_id: string }; Returns: undefined }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      update_item: {
        Args: {
          p_category: string
          p_condition: string
          p_description: string
          p_images?: string[]
          p_item_id: string
          p_name: string
        }
        Returns: undefined
      }
      water: {
        Args: {
          p_category: string
          p_condition: string
          p_description: string
          p_images?: string[]
          p_name: string
          p_target_id: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      board_tag: "harvest" | "question" | "chat" | "notice"
      exchange_status: "pending" | "shipped" | "received"
      fertilizer_reason:
        | "login_bonus"
        | "purchase"
        | "watering"
        | "admin"
        | "subscription"
      item_status: "growing" | "trading" | "completed" | "deleted"
      notification_type:
        | "watered"
        | "harvested"
        | "shipped"
        | "received"
        | "message"
        | "board_comment"
      purchase_kind: "fertilizer" | "premium"
      purchase_platform: "ios" | "android" | "admin"
      rating_type: "communication" | "quality"
      report_status: "open" | "resolved" | "dismissed"
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
      board_tag: ["harvest", "question", "chat", "notice"],
      exchange_status: ["pending", "shipped", "received"],
      fertilizer_reason: [
        "login_bonus",
        "purchase",
        "watering",
        "admin",
        "subscription",
      ],
      item_status: ["growing", "trading", "completed", "deleted"],
      notification_type: [
        "watered",
        "harvested",
        "shipped",
        "received",
        "message",
        "board_comment",
      ],
      purchase_kind: ["fertilizer", "premium"],
      purchase_platform: ["ios", "android", "admin"],
      rating_type: ["communication", "quality"],
      report_status: ["open", "resolved", "dismissed"],
    },
  },
} as const
