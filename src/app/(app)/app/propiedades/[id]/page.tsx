import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { requireUser } from "@/lib/supabase/require-user";
import type { OperationType, PropertyStatus, PropertyType } from "@/lib/validations/properties";
import { getContact } from "@/server/services/contacts";
import { getProperty, PropertyServiceError } from "@/server/services/properties";
import { PropertyWizard } from "../property-wizard";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_STATUS_BADGE_CLASS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPropertyLocation,
} from "../property-helpers";
import { PropertyGallery } from "./property-gallery";
import { PropertyStatusSelect } from "./property-status-select";
import { SharePropertyButton } from "./share-property-button";

/**
 * Ficha de la propiedad (T1.8): gallery (read-only, cover first), grouped data (precios,
 * características, ubicación — private fields marked), documents list (no upload yet), status
 * changer, share (public link → clipboard) and edit (pre-filled wizard). Private fields
 * (dirección exacta, matrícula, propietario) are visually tagged with a lock — they never appear
 * on the future public page (T1.10).
 */

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  tradicion_libertad: "Certificado de tradición y libertad",
  paz_salvos: "Paz y salvos",
  poder: "Poder",
  otro: "Otro",
};

function Field({
  label,
  value,
  isPrivate,
}: {
  label: string;
  value: React.ReactNode;
  isPrivate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {isPrivate && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1 py-0.5 text-[10px] font-medium">
            <Lock className="size-2.5" aria-hidden /> Privado
          </span>
        )}
      </dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default async function PropiedadFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId, supabase } = await requireUser();
  const { id } = await params;

  let property;
  try {
    property = await getProperty(id, tenantId);
  } catch (error) {
    if (error instanceof PropertyServiceError && error.code === "not_found") {
      notFound();
    }
    throw error;
  }

  const [{ data: tenant }, owner] = await Promise.all([
    supabase.from("tenants").select("slug").eq("id", tenantId).single(),
    getContact({ id: property.ownerContactId, tenantId }, {}).catch(() => null),
  ]);

  // Cover first, then by the sortOrder the service already applied.
  const orderedMedia = [...property.media].sort(
    (a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder,
  );

  const propertyType = property.propertyType as PropertyType;
  const operationType = property.operationType as OperationType;
  const status = property.status as PropertyStatus;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/app/propiedades" />} nativeButton={false}>
          <ArrowLeft /> Volver al listado
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-muted-foreground" data-testid="property-code">
            {property.internalCode}
          </p>
          <h1 className="text-2xl font-semibold">
            {PROPERTY_TYPE_LABELS[propertyType]} en {OPERATION_TYPE_LABELS[operationType].toLowerCase()}
          </h1>
          <p className="text-sm text-muted-foreground">{formatPropertyLocation(property)}</p>
          <Badge variant="secondary" className={PROPERTY_STATUS_BADGE_CLASS[status]}>
            {PROPERTY_STATUS_LABELS[status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PropertyStatusSelect propertyId={property.id} status={status} />
          <SharePropertyButton
            tenantSlug={tenant?.slug ?? ""}
            internalCode={property.internalCode}
          />
          <PropertyWizard
            mode="edit"
            property={property}
            ownerLabel={owner ? `${owner.fullName} · ${owner.phone}` : undefined}
          />
        </div>
      </header>

      <PropertyGallery
        media={orderedMedia.map((m) => ({
          id: m.id,
          url: m.url,
          mediaType: m.mediaType,
          isCover: m.isCover,
        }))}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Precios</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              {(operationType === "venta" || operationType === "ambas") && (
                <Field
                  label="Precio de venta"
                  value={property.salePriceCop != null ? formatCOP(property.salePriceCop) : "—"}
                />
              )}
              {(operationType === "arriendo" || operationType === "ambas") && (
                <Field
                  label="Canon mensual"
                  value={property.monthlyRentCop != null ? formatCOP(property.monthlyRentCop) : "—"}
                />
              )}
              <Field
                label="Comisión"
                value={
                  property.commissionPercentage != null
                    ? `${Number(property.commissionPercentage)} %`
                    : "—"
                }
              />
              <Field
                label="Exclusividad"
                value={
                  property.exclusivity
                    ? property.exclusivityUntil
                      ? `Sí, hasta ${property.exclusivityUntil}`
                      : "Sí"
                    : "No"
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Características</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Área" value={property.areaM2 != null ? `${property.areaM2} m²` : "—"} />
              <Field label="Habitaciones" value={property.bedrooms ?? "—"} />
              <Field label="Baños" value={property.bathrooms ?? "—"} />
              <Field label="Parqueaderos" value={property.parkingSpots ?? "—"} />
              <Field label="Estrato" value={property.stratum ?? "—"} />
              <Field
                label="Antigüedad"
                value={property.ageYears != null ? `${property.ageYears} años` : "—"}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ubicación</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Dirección exacta" value={property.privateAddress ?? "—"} isPrivate />
              <Field label="Barrio" value={property.neighborhood ?? "—"} />
              <Field label="Ciudad" value={property.city ?? "—"} />
              <Field label="Departamento" value={property.department ?? "—"} />
              <Field label="Matrícula inmobiliaria" value={property.registrationNumber ?? "—"} isPrivate />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propietario y documentos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl>
              <Field
                label="Propietario"
                value={owner ? `${owner.fullName} · ${owner.phone}` : "—"}
                isPrivate
              />
            </dl>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Documentos</p>
              {property.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin documentos adjuntos todavía.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {property.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="font-medium">{doc.name}</span>
                      {doc.documentType && (
                        <span className="text-xs text-muted-foreground">
                          ({DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {property.description && (
        <Card>
          <CardHeader>
            <CardTitle>Descripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{property.description}</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
