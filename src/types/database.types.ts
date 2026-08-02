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
      _escrow_test_log: {
        Row: {
          detail: string | null
          n: number
          name: string | null
          result: string | null
        }
        Insert: {
          detail?: string | null
          n?: number
          name?: string | null
          result?: string | null
        }
        Update: {
          detail?: string | null
          n?: number
          name?: string | null
          result?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          payload: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: never
          payload?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: never
          payload?: Json | null
        }
        Relationships: []
      }
      AuditLog: {
        Row: {
          action: string
          actorId: string
          createdAt: string
          id: string
          ipHash: string | null
          metadata: Json | null
          requestId: string
          targetId: string
          targetType: string
        }
        Insert: {
          action: string
          actorId: string
          createdAt?: string
          id: string
          ipHash?: string | null
          metadata?: Json | null
          requestId: string
          targetId: string
          targetType: string
        }
        Update: {
          action?: string
          actorId?: string
          createdAt?: string
          id?: string
          ipHash?: string | null
          metadata?: Json | null
          requestId?: string
          targetId?: string
          targetType?: string
        }
        Relationships: [
          {
            foreignKeyName: "AuditLog_actorId_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Category: {
        Row: {
          active: boolean
          attributeSchema: Json
          id: string
          name: Json
          parentId: string | null
          slug: string
        }
        Insert: {
          active?: boolean
          attributeSchema: Json
          id: string
          name: Json
          parentId?: string | null
          slug: string
        }
        Update: {
          active?: boolean
          attributeSchema?: Json
          id?: string
          name?: Json
          parentId?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "Category_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
        ]
      }
      Delivery: {
        Row: {
          createdAt: string
          evidenceIds: string[] | null
          id: string
          orderId: string
          sellerId: string
          summary: string
        }
        Insert: {
          createdAt?: string
          evidenceIds?: string[] | null
          id: string
          orderId: string
          sellerId: string
          summary: string
        }
        Update: {
          createdAt?: string
          evidenceIds?: string[] | null
          id?: string
          orderId?: string
          sellerId?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "Delivery_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "Order"
            referencedColumns: ["id"]
          },
        ]
      }
      Dispute: {
        Row: {
          appealDueAt: string | null
          appealEvidenceIds: string[] | null
          appealStatement: string | null
          assignedTo: string | null
          createdAt: string
          decidedBy: string | null
          decisionReason: string | null
          evidenceIds: string[] | null
          id: string
          openedBy: string
          orderId: string
          reasonCode: string
          resolvedAt: string | null
          responseDueAt: string
          statement: string
          status: Database["public"]["Enums"]["DisputeStatus"]
        }
        Insert: {
          appealDueAt?: string | null
          appealEvidenceIds?: string[] | null
          appealStatement?: string | null
          assignedTo?: string | null
          createdAt?: string
          decidedBy?: string | null
          decisionReason?: string | null
          evidenceIds?: string[] | null
          id: string
          openedBy: string
          orderId: string
          reasonCode: string
          resolvedAt?: string | null
          responseDueAt: string
          statement: string
          status?: Database["public"]["Enums"]["DisputeStatus"]
        }
        Update: {
          appealDueAt?: string | null
          appealEvidenceIds?: string[] | null
          appealStatement?: string | null
          assignedTo?: string | null
          createdAt?: string
          decidedBy?: string | null
          decisionReason?: string | null
          evidenceIds?: string[] | null
          id?: string
          openedBy?: string
          orderId?: string
          reasonCode?: string
          resolvedAt?: string | null
          responseDueAt?: string
          statement?: string
          status?: Database["public"]["Enums"]["DisputeStatus"]
        }
        Relationships: [
          {
            foreignKeyName: "Dispute_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "Order"
            referencedColumns: ["id"]
          },
        ]
      }
      early_leads: {
        Row: {
          contact: string
          created_at: string
          id: number
          role: string
        }
        Insert: {
          contact: string
          created_at?: string
          id?: never
          role?: string
        }
        Update: {
          contact?: string
          created_at?: string
          id?: never
          role?: string
        }
        Relationships: []
      }
      IdempotencyKey: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          key: string
          requestHash: string
          response: Json | null
          scope: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          key: string
          requestHash: string
          response?: Json | null
          scope: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          key?: string
          requestHash?: string
          response?: Json | null
          scope?: string
        }
        Relationships: []
      }
      LedgerAccount: {
        Row: {
          accountType: string
          createdAt: string
          currency: string
          id: string
          ownerId: string | null
          ownerType: string
        }
        Insert: {
          accountType: string
          createdAt?: string
          currency: string
          id: string
          ownerId?: string | null
          ownerType: string
        }
        Update: {
          accountType?: string
          createdAt?: string
          currency?: string
          id?: string
          ownerId?: string | null
          ownerType?: string
        }
        Relationships: []
      }
      LedgerEntry: {
        Row: {
          accountId: string
          amountMinor: number
          createdAt: string
          currency: string
          direction: Database["public"]["Enums"]["LedgerDirection"]
          id: string
          transactionId: string
        }
        Insert: {
          accountId: string
          amountMinor: number
          createdAt?: string
          currency: string
          direction: Database["public"]["Enums"]["LedgerDirection"]
          id: string
          transactionId: string
        }
        Update: {
          accountId?: string
          amountMinor?: number
          createdAt?: string
          currency?: string
          direction?: Database["public"]["Enums"]["LedgerDirection"]
          id?: string
          transactionId?: string
        }
        Relationships: [
          {
            foreignKeyName: "LedgerEntry_accountId_fkey"
            columns: ["accountId"]
            isOneToOne: false
            referencedRelation: "LedgerAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "LedgerEntry_transactionId_fkey"
            columns: ["transactionId"]
            isOneToOne: false
            referencedRelation: "LedgerTransaction"
            referencedColumns: ["id"]
          },
        ]
      }
      LedgerTransaction: {
        Row: {
          id: string
          idempotencyKey: string
          postedAt: string
          referenceId: string
          referenceType: string
          type: string
        }
        Insert: {
          id: string
          idempotencyKey: string
          postedAt?: string
          referenceId: string
          referenceType: string
          type: string
        }
        Update: {
          id?: string
          idempotencyKey?: string
          postedAt?: string
          referenceId?: string
          referenceType?: string
          type?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          category: string
          created_at: string
          created_ip: string | null
          description: string | null
          game_type: string
          id: string
          price: number
          seller_deals: number
          seller_id: string | null
          seller_name: string | null
          seller_verified: boolean
          status: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          created_ip?: string | null
          description?: string | null
          game_type: string
          id?: string
          price: number
          seller_deals?: number
          seller_id?: string | null
          seller_name?: string | null
          seller_verified?: boolean
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_ip?: string | null
          description?: string | null
          game_type?: string
          id?: string
          price?: number
          seller_deals?: number
          seller_id?: string | null
          seller_name?: string | null
          seller_verified?: boolean
          status?: string
          title?: string
        }
        Relationships: []
      }
      ModerationCase: {
        Row: {
          assignedTo: string | null
          createdAt: string
          decisionReason: string | null
          id: string
          offerId: string
          reasons: string[] | null
          reviewedAt: string | null
          status: Database["public"]["Enums"]["ModerationStatus"]
        }
        Insert: {
          assignedTo?: string | null
          createdAt?: string
          decisionReason?: string | null
          id: string
          offerId: string
          reasons?: string[] | null
          reviewedAt?: string | null
          status?: Database["public"]["Enums"]["ModerationStatus"]
        }
        Update: {
          assignedTo?: string | null
          createdAt?: string
          decisionReason?: string | null
          id?: string
          offerId?: string
          reasons?: string[] | null
          reviewedAt?: string | null
          status?: Database["public"]["Enums"]["ModerationStatus"]
        }
        Relationships: [
          {
            foreignKeyName: "ModerationCase_offerId_fkey"
            columns: ["offerId"]
            isOneToOne: false
            referencedRelation: "Offer"
            referencedColumns: ["id"]
          },
        ]
      }
      OAuthAccount: {
        Row: {
          createdAt: string
          email: string
          id: string
          provider: Database["public"]["Enums"]["OAuthProvider"]
          providerAccountId: string
          userId: string
        }
        Insert: {
          createdAt?: string
          email: string
          id: string
          provider: Database["public"]["Enums"]["OAuthProvider"]
          providerAccountId: string
          userId: string
        }
        Update: {
          createdAt?: string
          email?: string
          id?: string
          provider?: Database["public"]["Enums"]["OAuthProvider"]
          providerAccountId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "OAuthAccount_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Offer: {
        Row: {
          currency: string
          id: string
          priceMinor: number
          productId: string
          sellerId: string
          status: Database["public"]["Enums"]["OfferStatus"]
          stock: number
          version: number
        }
        Insert: {
          currency: string
          id: string
          priceMinor: number
          productId: string
          sellerId: string
          status?: Database["public"]["Enums"]["OfferStatus"]
          stock?: number
          version?: number
        }
        Update: {
          currency?: string
          id?: string
          priceMinor?: number
          productId?: string
          sellerId?: string
          status?: Database["public"]["Enums"]["OfferStatus"]
          stock?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "Offer_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "Product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Offer_sellerId_fkey"
            columns: ["sellerId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Order: {
        Row: {
          autoCompleteAt: string | null
          buyerId: string
          createdAt: string
          currency: string
          expiresAt: string | null
          id: string
          offerId: string
          sellerId: string
          snapshot: Json
          status: Database["public"]["Enums"]["OrderStatus"]
          totalMinor: number
          updatedAt: string
          version: number
        }
        Insert: {
          autoCompleteAt?: string | null
          buyerId: string
          createdAt?: string
          currency: string
          expiresAt?: string | null
          id: string
          offerId: string
          sellerId: string
          snapshot: Json
          status?: Database["public"]["Enums"]["OrderStatus"]
          totalMinor: number
          updatedAt: string
          version?: number
        }
        Update: {
          autoCompleteAt?: string | null
          buyerId?: string
          createdAt?: string
          currency?: string
          expiresAt?: string | null
          id?: string
          offerId?: string
          sellerId?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["OrderStatus"]
          totalMinor?: number
          updatedAt?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "Order_buyerId_fkey"
            columns: ["buyerId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Order_offerId_fkey"
            columns: ["offerId"]
            isOneToOne: false
            referencedRelation: "Offer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Order_sellerId_fkey"
            columns: ["sellerId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["escrow_actor"]
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          metadata: Json
          order_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          actor_role: Database["public"]["Enums"]["escrow_actor"]
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          metadata?: Json
          order_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["escrow_actor"]
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          metadata?: Json
          order_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dispute_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      OrderEvent: {
        Row: {
          actorId: string | null
          createdAt: string
          id: string
          orderId: string
          payload: Json
          type: string
        }
        Insert: {
          actorId?: string | null
          createdAt?: string
          id: string
          orderId: string
          payload: Json
          type: string
        }
        Update: {
          actorId?: string | null
          createdAt?: string
          id?: string
          orderId?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "OrderEvent_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "Order"
            referencedColumns: ["id"]
          },
        ]
      }
      OrderMessage: {
        Row: {
          body: string
          createdAt: string
          id: string
          orderId: string
          senderId: string
        }
        Insert: {
          body: string
          createdAt?: string
          id: string
          orderId: string
          senderId: string
        }
        Update: {
          body?: string
          createdAt?: string
          id?: string
          orderId?: string
          senderId?: string
        }
        Relationships: [
          {
            foreignKeyName: "OrderMessage_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "Order"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_complete_at: string | null
          buyer_id: string | null
          buyer_name: string | null
          cancel_reason: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          dispute_opened_at: string | null
          dispute_reason: string | null
          escrow_amount: number
          escrow_held_at: string | null
          fee_amount: number
          fee_minor: number | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          listing_title: string | null
          paid_at: string | null
          payment_id: string | null
          payment_intent_id: string | null
          payout_minor: number | null
          provider: Database["public"]["Enums"]["payment_provider"]
          qr_expires_at: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string | null
          seller_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_changed_at: string
          total_minor: number | null
          updated_at: string | null
          version: number
        }
        Insert: {
          auto_complete_at?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          cancel_reason?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          escrow_amount: number
          escrow_held_at?: string | null
          fee_amount: number
          fee_minor?: number | null
          id?: string
          idempotency_key?: string | null
          listing_id?: string | null
          listing_title?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_intent_id?: string | null
          payout_minor?: number | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          qr_expires_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_changed_at?: string
          total_minor?: number | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          auto_complete_at?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          cancel_reason?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          escrow_amount?: number
          escrow_held_at?: string | null
          fee_amount?: number
          fee_minor?: number | null
          id?: string
          idempotency_key?: string | null
          listing_id?: string | null
          listing_title?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_intent_id?: string | null
          payout_minor?: number | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          qr_expires_at?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string | null
          seller_name?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_changed_at?: string
          total_minor?: number | null
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      payment_webhooks: {
        Row: {
          amount_minor: number | null
          attempts: number
          error_code: string | null
          event_id: string
          event_type: string | null
          id: number
          order_id: string | null
          payment_id: string | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          raw: Json
          received_at: string
          signature: string | null
          status: Database["public"]["Enums"]["webhook_status"]
        }
        Insert: {
          amount_minor?: number | null
          attempts?: number
          error_code?: string | null
          event_id: string
          event_type?: string | null
          id?: never
          order_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          raw: Json
          received_at?: string
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Update: {
          amount_minor?: number | null
          attempts?: number
          error_code?: string | null
          event_id?: string
          event_type?: string | null
          id?: never
          order_id?: string | null
          payment_id?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          raw?: Json
          received_at?: string
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhooks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dispute_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhooks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      PaymentWebhook: {
        Row: {
          errorCode: string | null
          eventType: string
          id: string
          occurredAt: string
          orderId: string
          paymentId: string
          processedAt: string | null
          provider: string
          providerEventId: string
          rawBody: string
          receivedAt: string
          status: Database["public"]["Enums"]["WebhookStatus"]
        }
        Insert: {
          errorCode?: string | null
          eventType: string
          id: string
          occurredAt: string
          orderId: string
          paymentId: string
          processedAt?: string | null
          provider: string
          providerEventId: string
          rawBody: string
          receivedAt?: string
          status?: Database["public"]["Enums"]["WebhookStatus"]
        }
        Update: {
          errorCode?: string | null
          eventType?: string
          id?: string
          occurredAt?: string
          orderId?: string
          paymentId?: string
          processedAt?: string | null
          provider?: string
          providerEventId?: string
          rawBody?: string
          receivedAt?: string
          status?: Database["public"]["Enums"]["WebhookStatus"]
        }
        Relationships: []
      }
      PayoutHold: {
        Row: {
          appealable: boolean
          createdAt: string
          id: string
          placedBy: string
          publicExplanation: string
          reasonCode: string
          referenceId: string
          releasedAt: string | null
          releaseReason: string | null
          reviewAt: string
          userId: string
        }
        Insert: {
          appealable?: boolean
          createdAt?: string
          id: string
          placedBy: string
          publicExplanation: string
          reasonCode: string
          referenceId: string
          releasedAt?: string | null
          releaseReason?: string | null
          reviewAt: string
          userId: string
        }
        Update: {
          appealable?: boolean
          createdAt?: string
          id?: string
          placedBy?: string
          publicExplanation?: string
          reasonCode?: string
          referenceId?: string
          releasedAt?: string | null
          releaseReason?: string | null
          reviewAt?: string
          userId?: string
        }
        Relationships: []
      }
      Product: {
        Row: {
          attributes: Json
          categoryId: string
          createdAt: string
          id: string
          slug: string
          title: Json
        }
        Insert: {
          attributes: Json
          categoryId: string
          createdAt?: string
          id: string
          slug: string
          title: Json
        }
        Update: {
          attributes?: Json
          categoryId?: string
          createdAt?: string
          id?: string
          slug?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "Product_categoryId_fkey"
            columns: ["categoryId"]
            isOneToOne: false
            referencedRelation: "Category"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit: {
        Row: {
          action: string
          actor: string
          hits: number
          window_start: string
        }
        Insert: {
          action: string
          actor: string
          hits?: number
          window_start?: string
        }
        Update: {
          action?: string
          actor?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      Review: {
        Row: {
          authorId: string
          body: string
          createdAt: string
          id: string
          orderId: string
          rating: number
          sellerId: string
        }
        Insert: {
          authorId: string
          body: string
          createdAt?: string
          id: string
          orderId: string
          rating: number
          sellerId: string
        }
        Update: {
          authorId?: string
          body?: string
          createdAt?: string
          id?: string
          orderId?: string
          rating?: number
          sellerId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Review_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "Order"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string | null
          author_name: string
          city: string | null
          created_at: string
          had_dispute: boolean
          id: string
          order_id: string | null
          rating: number
          subject: string | null
          text: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          city?: string | null
          created_at?: string
          had_dispute?: boolean
          id?: string
          order_id?: string | null
          rating: number
          subject?: string | null
          text: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          city?: string | null
          created_at?: string
          had_dispute?: boolean
          id?: string
          order_id?: string | null
          rating?: number
          subject?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "dispute_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      RiskCase: {
        Row: {
          assignedTo: string | null
          createdAt: string
          decisionReason: string | null
          id: string
          level: string
          operationType: string
          reasonCodes: string[] | null
          referenceId: string
          reviewedAt: string | null
          score: number
          status: Database["public"]["Enums"]["RiskCaseStatus"]
          userId: string
        }
        Insert: {
          assignedTo?: string | null
          createdAt?: string
          decisionReason?: string | null
          id: string
          level: string
          operationType: string
          reasonCodes?: string[] | null
          referenceId: string
          reviewedAt?: string | null
          score: number
          status?: Database["public"]["Enums"]["RiskCaseStatus"]
          userId: string
        }
        Update: {
          assignedTo?: string | null
          createdAt?: string
          decisionReason?: string | null
          id?: string
          level?: string
          operationType?: string
          reasonCodes?: string[] | null
          referenceId?: string
          reviewedAt?: string | null
          score?: number
          status?: Database["public"]["Enums"]["RiskCaseStatus"]
          userId?: string
        }
        Relationships: []
      }
      sales_feed: {
        Row: {
          amount: number | null
          buyer_name: string | null
          created_at: string
          id: string
          order_id: string | null
          title: string | null
        }
        Insert: {
          amount?: number | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          title?: string | null
        }
        Update: {
          amount?: number | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_feed_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "dispute_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_feed_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          city: string | null
          created_at: string
          deals: number
          nickname: string
          rating: number | null
          user_id: string
          verified: boolean
        }
        Insert: {
          city?: string | null
          created_at?: string
          deals?: number
          nickname: string
          rating?: number | null
          user_id: string
          verified?: boolean
        }
        Update: {
          city?: string | null
          created_at?: string
          deals?: number
          nickname?: string
          rating?: number | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      Session: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          revokedAt: string | null
          tokenHash: string
          userId: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          revokedAt?: string | null
          tokenHash: string
          userId: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          revokedAt?: string | null
          tokenHash?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Session_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_messages: {
        Row: {
          body: string
          created_at: string
          id: number
          order_id: string
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: never
          order_id: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: never
          order_id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dispute_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["escrow_actor"]
          amount_minor: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          metadata: Json
          order_id: string
          posted_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_event_id: string | null
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["escrow_tx_status"]
          type: Database["public"]["Enums"]["escrow_tx_type"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["escrow_actor"]
          amount_minor: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          metadata?: Json
          order_id: string
          posted_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_event_id?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["escrow_tx_status"]
          type: Database["public"]["Enums"]["escrow_tx_type"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["escrow_actor"]
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          order_id?: string
          posted_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_event_id?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["escrow_tx_status"]
          type?: Database["public"]["Enums"]["escrow_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dispute_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          createdAt: string
          email: string
          emailVerifiedAt: string | null
          failedLoginCount: number
          id: string
          locale: string
          lockedUntil: string | null
          passwordHash: string | null
          status: Database["public"]["Enums"]["UserStatus"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          email: string
          emailVerifiedAt?: string | null
          failedLoginCount?: number
          id: string
          locale?: string
          lockedUntil?: string | null
          passwordHash?: string | null
          status?: Database["public"]["Enums"]["UserStatus"]
          updatedAt: string
        }
        Update: {
          createdAt?: string
          email?: string
          emailVerifiedAt?: string | null
          failedLoginCount?: number
          id?: string
          locale?: string
          lockedUntil?: string | null
          passwordHash?: string | null
          status?: Database["public"]["Enums"]["UserStatus"]
          updatedAt?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      UserRole: {
        Row: {
          grantedAt: string
          grantedBy: string | null
          role: Database["public"]["Enums"]["Role"]
          userId: string
        }
        Insert: {
          grantedAt?: string
          grantedBy?: string | null
          role: Database["public"]["Enums"]["Role"]
          userId: string
        }
        Update: {
          grantedAt?: string
          grantedBy?: string | null
          role?: Database["public"]["Enums"]["Role"]
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserRole_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      VerificationToken: {
        Row: {
          consumedAt: string | null
          createdAt: string
          expiresAt: string
          id: string
          purpose: string
          tokenHash: string
          userId: string
        }
        Insert: {
          consumedAt?: string | null
          createdAt?: string
          expiresAt: string
          id: string
          purpose: string
          tokenHash: string
          userId: string
        }
        Update: {
          consumedAt?: string | null
          createdAt?: string
          expiresAt?: string
          id?: string
          purpose?: string
          tokenHash?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "VerificationToken_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dispute_queue: {
        Row: {
          age: string | null
          buyer_id: string | null
          dispute_opened_at: string | null
          dispute_reason: string | null
          escrow_amount: number | null
          fee_amount: number | null
          id: string | null
          listing_title: string | null
          messages: number | null
          seller_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_minor: number | null
          version: number | null
        }
        Insert: {
          age?: never
          buyer_id?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          escrow_amount?: number | null
          fee_amount?: number | null
          id?: string | null
          listing_title?: string | null
          messages?: never
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_minor?: number | null
          version?: number | null
        }
        Update: {
          age?: never
          buyer_id?: string | null
          dispute_opened_at?: string | null
          dispute_reason?: string | null
          escrow_amount?: number | null
          fee_amount?: number | null
          id?: string | null
          listing_title?: string | null
          messages?: never
          seller_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_minor?: number | null
          version?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_confirm_manual_payment: {
        Args: { p_order_id: string; p_payment_id: string; p_reason?: string }
        Returns: Json
      }
      api_add_lead: {
        Args: { p_contact: string; p_role: string }
        Returns: undefined
      }
      api_confirm_receipt: { Args: { p_order: string }; Returns: undefined }
      api_create_listing: {
        Args: {
          p_category: string
          p_desc: string
          p_game: string
          p_price: number
          p_title: string
        }
        Returns: string
      }
      api_create_order: { Args: { p_listing_id: string }; Returns: string }
      api_mark_transferred: {
        Args: { p_order: string; p_video: string }
        Returns: undefined
      }
      api_open_dispute: {
        Args: { p_order: string; p_reason: string; p_video: string }
        Returns: string
      }
      api_resolve_dispute: {
        Args: { p_decision: string; p_order: string }
        Returns: undefined
      }
      arbiter_resolve_dispute: {
        Args: {
          p_expected_version?: number
          p_order_id: string
          p_outcome: string
          p_reason: string
        }
        Returns: Json
      }
      buyer_confirm_order: {
        Args: { p_expected_version?: number; p_order_id: string }
        Returns: Json
      }
      check_rate: {
        Args: { p_action: string; p_limit: number; p_minutes: number }
        Returns: undefined
      }
      escrow_actor_for: {
        Args: { p_order: Database["public"]["Tables"]["orders"]["Row"] }
        Returns: Database["public"]["Enums"]["escrow_actor"]
      }
      escrow_apply_transition: {
        Args: {
          p_actor: Database["public"]["Enums"]["escrow_actor"]
          p_expected_version?: number
          p_order_id: string
          p_patch?: Json
          p_reason?: string
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          auto_complete_at: string | null
          buyer_id: string | null
          buyer_name: string | null
          cancel_reason: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          dispute_opened_at: string | null
          dispute_reason: string | null
          escrow_amount: number
          escrow_held_at: string | null
          fee_amount: number
          fee_minor: number | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          listing_title: string | null
          paid_at: string | null
          payment_id: string | null
          payment_intent_id: string | null
          payout_minor: number | null
          provider: Database["public"]["Enums"]["payment_provider"]
          qr_expires_at: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string | null
          seller_name: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_changed_at: string
          total_minor: number | null
          updated_at: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      escrow_attach_payment_intent: {
        Args: {
          p_intent_id: string
          p_order_id: string
          p_qr_expires_at: string
        }
        Returns: Json
      }
      escrow_create_order: {
        Args: { p_idempotency_key: string; p_listing_id: string }
        Returns: Json
      }
      escrow_is_terminal: {
        Args: { p_status: Database["public"]["Enums"]["order_status"] }
        Returns: boolean
      }
      escrow_post_transaction: {
        Args: {
          p_actor_id?: string
          p_actor_role?: Database["public"]["Enums"]["escrow_actor"]
          p_amount_minor: number
          p_idempotency_key: string
          p_metadata?: Json
          p_order_id: string
          p_provider_event_id?: string
          p_provider_payment_id?: string
          p_type: Database["public"]["Enums"]["escrow_tx_type"]
        }
        Returns: string
      }
      escrow_run_slas: { Args: never; Returns: Json }
      escrow_settle: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["escrow_actor"]
          p_order: Database["public"]["Tables"]["orders"]["Row"]
          p_outcome: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      escrow_transition_allowed: {
        Args: {
          p_actor: Database["public"]["Enums"]["escrow_actor"]
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_arbiter: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      kaspi_webhook_capture: {
        Args: {
          p_amount_minor: number
          p_event_id: string
          p_event_type: string
          p_order_id: string
          p_payment_id: string
          p_raw: Json
          p_signature?: string
        }
        Returns: Json
      }
      log_action: {
        Args: {
          p_action: string
          p_entity: string
          p_id: string
          p_payload?: Json
        }
        Returns: undefined
      }
      open_dispute: {
        Args: {
          p_expected_version?: number
          p_order_id: string
          p_reason: string
        }
        Returns: Json
      }
      sanitize: { Args: { txt: string }; Returns: string }
      seller_mark_delivered: {
        Args: {
          p_expected_version?: number
          p_order_id: string
          p_summary?: string
        }
        Returns: Json
      }
      tg_send: { Args: { message: string }; Returns: undefined }
    }
    Enums: {
      DisputeStatus:
        | "OPEN"
        | "WAITING_SELLER"
        | "IN_REVIEW"
        | "RESOLVED_BUYER"
        | "RESOLVED_SELLER"
        | "APPEALED"
        | "CLOSED"
      escrow_actor: "BUYER" | "SELLER" | "ARBITER" | "SYSTEM"
      escrow_tx_status: "PENDING" | "POSTED" | "FAILED" | "REVERSED"
      escrow_tx_type: "HOLD" | "FEE" | "PAYOUT" | "REFUND" | "CHARGEBACK"
      LedgerDirection: "DEBIT" | "CREDIT"
      ModerationStatus: "OPEN" | "IN_REVIEW" | "APPROVED" | "REJECTED"
      OAuthProvider: "GOOGLE" | "APPLE"
      OfferStatus:
        | "DRAFT"
        | "REVIEW"
        | "ACTIVE"
        | "PAUSED"
        | "REJECTED"
        | "CLOSED"
      order_status:
        | "CREATED"
        | "PENDING_PAYMENT"
        | "ESCROW_HOLD"
        | "VERIFYING"
        | "DISPUTE"
        | "COMPLETED"
        | "REFUNDED"
        | "CANCELLED"
        | "EXPIRED"
        | "FUNDS_HOLD"
        | "DATA_TRANSFERRED"
      OrderStatus:
        | "CREATED"
        | "AWAITING_PAYMENT"
        | "PAID"
        | "IN_DELIVERY"
        | "DELIVERED"
        | "COMPLETED"
        | "DISPUTED"
        | "REFUND_PENDING"
        | "REFUNDED"
        | "CANCELLED"
      payment_provider: "KASPI_QR" | "MANUAL"
      RiskCaseStatus: "OPEN" | "IN_REVIEW" | "CLEARED" | "RESTRICTED" | "CLOSED"
      Role: "BUYER" | "SELLER" | "MODERATOR" | "ADMIN"
      UserStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED"
      webhook_status:
        | "RECEIVED"
        | "PROCESSED"
        | "DUPLICATE"
        | "REJECTED"
        | "FAILED"
      WebhookStatus: "RECEIVED" | "PROCESSED" | "FAILED"
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
      DisputeStatus: [
        "OPEN",
        "WAITING_SELLER",
        "IN_REVIEW",
        "RESOLVED_BUYER",
        "RESOLVED_SELLER",
        "APPEALED",
        "CLOSED",
      ],
      escrow_actor: ["BUYER", "SELLER", "ARBITER", "SYSTEM"],
      escrow_tx_status: ["PENDING", "POSTED", "FAILED", "REVERSED"],
      escrow_tx_type: ["HOLD", "FEE", "PAYOUT", "REFUND", "CHARGEBACK"],
      LedgerDirection: ["DEBIT", "CREDIT"],
      ModerationStatus: ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED"],
      OAuthProvider: ["GOOGLE", "APPLE"],
      OfferStatus: [
        "DRAFT",
        "REVIEW",
        "ACTIVE",
        "PAUSED",
        "REJECTED",
        "CLOSED",
      ],
      order_status: [
        "CREATED",
        "PENDING_PAYMENT",
        "ESCROW_HOLD",
        "VERIFYING",
        "DISPUTE",
        "COMPLETED",
        "REFUNDED",
        "CANCELLED",
        "EXPIRED",
        "FUNDS_HOLD",
        "DATA_TRANSFERRED",
      ],
      OrderStatus: [
        "CREATED",
        "AWAITING_PAYMENT",
        "PAID",
        "IN_DELIVERY",
        "DELIVERED",
        "COMPLETED",
        "DISPUTED",
        "REFUND_PENDING",
        "REFUNDED",
        "CANCELLED",
      ],
      payment_provider: ["KASPI_QR", "MANUAL"],
      RiskCaseStatus: ["OPEN", "IN_REVIEW", "CLEARED", "RESTRICTED", "CLOSED"],
      Role: ["BUYER", "SELLER", "MODERATOR", "ADMIN"],
      UserStatus: ["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"],
      webhook_status: [
        "RECEIVED",
        "PROCESSED",
        "DUPLICATE",
        "REJECTED",
        "FAILED",
      ],
      WebhookStatus: ["RECEIVED", "PROCESSED", "FAILED"],
    },
  },
} as const
