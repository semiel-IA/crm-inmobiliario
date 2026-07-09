CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"document_id" text,
	"contact_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text,
	"assigned_agent_id" uuid,
	"lead_status" text DEFAULT 'nuevo' NOT NULL,
	"consent_at" timestamp with time zone,
	"consent_channel" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_lead_status_check" CHECK ("contacts"."lead_status" in ('nuevo', 'contactado', 'calificado', 'inactivo')),
	CONSTRAINT "contacts_source_check" CHECK ("contacts"."source" is null or "contacts"."source" in ('portal', 'referido', 'redes', 'fachada', 'whatsapp', 'web')),
	CONSTRAINT "contacts_types_check" CHECK ("contacts"."contact_types" <@ ARRAY['comprador', 'arrendatario', 'propietario']::text[])
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"internal_code" text NOT NULL,
	"property_type" text NOT NULL,
	"operation_type" text NOT NULL,
	"status" text DEFAULT 'disponible' NOT NULL,
	"owner_contact_id" uuid NOT NULL,
	"sale_price_cop" bigint,
	"monthly_rent_cop" bigint,
	"area_m2" integer,
	"bedrooms" smallint,
	"bathrooms" smallint,
	"parking_spots" smallint,
	"stratum" smallint,
	"age_years" smallint,
	"private_address" text,
	"neighborhood" text,
	"city" text,
	"department" text,
	"lat" numeric(9, 6),
	"lng" numeric(9, 6),
	"registration_number" text,
	"exclusivity" boolean DEFAULT false NOT NULL,
	"exclusivity_until" date,
	"commission_percentage" numeric(5, 2),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "properties_tenant_internal_code_unique" UNIQUE("tenant_id","internal_code"),
	CONSTRAINT "properties_property_type_check" CHECK ("properties"."property_type" in ('apartamento', 'casa', 'lote', 'local', 'oficina', 'bodega', 'finca')),
	CONSTRAINT "properties_operation_type_check" CHECK ("properties"."operation_type" in ('venta', 'arriendo', 'ambas')),
	CONSTRAINT "properties_status_check" CHECK ("properties"."status" in ('disponible', 'reservada', 'vendida', 'arrendada', 'inactiva')),
	CONSTRAINT "properties_stratum_check" CHECK ("properties"."stratum" is null or ("properties"."stratum" between 1 and 6)),
	CONSTRAINT "properties_sale_price_non_negative_check" CHECK ("properties"."sale_price_cop" is null or "properties"."sale_price_cop" >= 0),
	CONSTRAINT "properties_monthly_rent_non_negative_check" CHECK ("properties"."monthly_rent_cop" is null or "properties"."monthly_rent_cop" >= 0)
);
--> statement-breakpoint
CREATE TABLE "property_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document_type" text,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_documents_type_check" CHECK ("property_documents"."document_type" is null or "property_documents"."document_type" in ('tradicion_libertad', 'paz_salvos', 'poder', 'otro'))
);
--> statement-breakpoint
CREATE TABLE "property_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"url" text NOT NULL,
	"media_type" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_media_type_check" CHECK ("property_media"."media_type" in ('foto', 'video'))
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_contact_id_contacts_id_fk" FOREIGN KEY ("owner_contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_tenant_id_idx" ON "contacts" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "contacts_tenant_created_idx" ON "contacts" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "contacts_tenant_lead_status_idx" ON "contacts" USING btree ("tenant_id","lead_status");--> statement-breakpoint
CREATE INDEX "properties_tenant_id_idx" ON "properties" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "properties_tenant_status_idx" ON "properties" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "properties_tenant_type_operation_idx" ON "properties" USING btree ("tenant_id","property_type","operation_type");--> statement-breakpoint
CREATE INDEX "properties_tenant_created_idx" ON "properties" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "properties_tenant_owner_idx" ON "properties" USING btree ("tenant_id","owner_contact_id");--> statement-breakpoint
CREATE INDEX "property_documents_tenant_property_idx" ON "property_documents" USING btree ("tenant_id","property_id");--> statement-breakpoint
CREATE INDEX "property_media_tenant_property_order_idx" ON "property_media" USING btree ("tenant_id","property_id","sort_order");