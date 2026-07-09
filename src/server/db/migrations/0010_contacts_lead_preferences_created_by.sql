ALTER TABLE "contacts" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "lead_preferences" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_preferences" ADD CONSTRAINT "lead_preferences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;