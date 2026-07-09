CREATE TABLE "lead_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"operation_type" text NOT NULL,
	"property_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"zones" text[] DEFAULT '{}'::text[] NOT NULL,
	"budget_min_cop" bigint,
	"budget_max_cop" bigint,
	"min_bedrooms" smallint,
	"min_bathrooms" smallint,
	"min_parking_spots" smallint,
	"min_stratum" smallint,
	"max_stratum" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_preferences_operation_type_check" CHECK ("lead_preferences"."operation_type" in ('venta', 'arriendo')),
	CONSTRAINT "lead_preferences_property_types_check" CHECK ("lead_preferences"."property_types" <@ ARRAY['apartamento', 'casa', 'lote', 'local', 'oficina', 'bodega', 'finca']::text[]),
	CONSTRAINT "lead_preferences_budget_range_check" CHECK ("lead_preferences"."budget_min_cop" is null or "lead_preferences"."budget_max_cop" is null or "lead_preferences"."budget_min_cop" < "lead_preferences"."budget_max_cop"),
	CONSTRAINT "lead_preferences_budget_non_negative_check" CHECK (("lead_preferences"."budget_min_cop" is null or "lead_preferences"."budget_min_cop" >= 0) and ("lead_preferences"."budget_max_cop" is null or "lead_preferences"."budget_max_cop" >= 0)),
	CONSTRAINT "lead_preferences_min_bedrooms_non_negative_check" CHECK ("lead_preferences"."min_bedrooms" is null or "lead_preferences"."min_bedrooms" >= 0),
	CONSTRAINT "lead_preferences_min_bathrooms_non_negative_check" CHECK ("lead_preferences"."min_bathrooms" is null or "lead_preferences"."min_bathrooms" >= 0),
	CONSTRAINT "lead_preferences_min_parking_non_negative_check" CHECK ("lead_preferences"."min_parking_spots" is null or "lead_preferences"."min_parking_spots" >= 0),
	CONSTRAINT "lead_preferences_stratum_range_check" CHECK (("lead_preferences"."min_stratum" is null or ("lead_preferences"."min_stratum" between 1 and 6))
        and ("lead_preferences"."max_stratum" is null or ("lead_preferences"."max_stratum" between 1 and 6))
        and ("lead_preferences"."min_stratum" is null or "lead_preferences"."max_stratum" is null or "lead_preferences"."min_stratum" <= "lead_preferences"."max_stratum"))
);
--> statement-breakpoint
ALTER TABLE "lead_preferences" ADD CONSTRAINT "lead_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_preferences" ADD CONSTRAINT "lead_preferences_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_preferences_tenant_id_idx" ON "lead_preferences" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "lead_preferences_tenant_contact_idx" ON "lead_preferences" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_preferences_tenant_contact_operation_unique_idx" ON "lead_preferences" USING btree ("tenant_id","contact_id","operation_type");