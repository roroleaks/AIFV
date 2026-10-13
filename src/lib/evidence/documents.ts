/**
 * Uploaded source documents available to the Evidence Library.
 * Maps an entry's `fileName` to the stored copy of the document.
 */
import masterBundle from "@/assets/ivf-evidence-master-2026.pdf.asset.json";
import eshreOs2025 from "@/assets/eshre-os-guideline-2025.pdf.asset.json";
import consortPilot2009 from "@/assets/consort-olivennes-2009-pilot.pdf.asset.json";
import howles2006 from "@/assets/howles-2006-consort-algorithm.pdf.asset.json";
import consortRct2015 from "@/assets/consort-olivennes-2015-rct.pdf.asset.json";
import consortPouly2015 from "@/assets/consort-pouly-2015-usability.pdf.asset.json";

const bundles = [
  masterBundle,
  eshreOs2025,
  consortPilot2009,
  howles2006,
  consortRct2015,
  consortPouly2015,
];

export const documentUrlFor = (fileName?: string | undefined): string | undefined =>
  fileName ? bundles.find((b) => b.original_filename === fileName)?.url : undefined;
