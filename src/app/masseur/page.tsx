import { redirect } from "next/navigation";
import { portalHomePath } from "@/lib/portals";

/** Legacy `/masseur` → `/masseur/login`. */
export default function MasseurIndexPage() {
  redirect(portalHomePath("masseur"));
}
